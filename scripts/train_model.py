"""
Train XGBoost sale price model and export to ONNX.

Data sources:
  - centanet_sale_clean.csv  (~196K sale records)
  - centanet_rent_clean.csv  (~82K rent records)

Model: XGBoost regressor predicting log(price_per_sqft).
Features:
  - log_area          : log(saleable_area)
  - floor_level       : 0=low, 1=mid, 2=high
  - rooms             : 0=studio, 1-4
  - district_enc      : target encoding (mean log_price_per_sqft per district)
  - building_enc      : building mean log_price_per_sqft (0 if unknown)

Outputs:
  - public/model.onnx       : ONNX model file
  - public/model_meta.json  : district/building stats + metadata

Usage:  python scripts/train_model.py
"""

import json
import math
import os
import re
import sys

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error

# ── Paths ──────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_DIR, "private_data")
PUBLIC_DIR = os.path.join(PROJECT_DIR, "public")
SRC_LIB_DIR = os.path.join(PROJECT_DIR, "src", "lib")

SALE_CSV = os.path.join(DATA_DIR, "centanet_sale_clean.csv")
RENT_CSV = os.path.join(DATA_DIR, "centanet_rent_clean.csv")
ESTATE_CSV = os.path.join(DATA_DIR, "centanet_estate_mtr.csv")
DEVELOPER_CSV = os.path.join(DATA_DIR, "centanet_estate_developers.csv")
ONNX_OUTPUT = os.path.join(PUBLIC_DIR, "model.onnx")
META_OUTPUT = os.path.join(PUBLIC_DIR, "model_meta.json")
DISTRICT_CODES_OUTPUT = os.path.join(SRC_LIB_DIR, "districtCodes.ts")

# ── Estate Data (Building Age, MTR, Mall) ──────────────────────


def load_estate_data(csv_path: str) -> pd.DataFrame:
    print(f"Reading estate data from {csv_path}...")
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    print(f"  Parsed {len(df)} estate records")
    return df


def load_developer_data(csv_path: str) -> dict:
    """Load developer/management company data scraped from Centanet estate pages."""
    if not os.path.exists(csv_path):
        print(f"  WARNING: {csv_path} not found, skipping developer data")
        return {}
    print(f"Loading developer data from {csv_path}...")
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    print(f"  Parsed {len(df)} developer records")
    lookup = {}
    for _, row in df.iterrows():
        estate_name = str(row.get("estateNameHK", "")).strip()
        if estate_name:
            lookup[estate_name] = {
                "developer": str(row.get("developer", "")).strip(),
                "managementCompany": str(row.get("managementCompany", "")).strip(),
            }
    return lookup


def build_estate_lookup(estate_df: pd.DataFrame, developer_lookup: dict = None) -> dict:
    lookup = {}
    for _, row in estate_df.iterrows():
        name = str(row.get("estateNameHK", "")).strip()
        if not name:
            continue
        entry = {
            "maxBuildingAge": int(row.get("maxBuildingAge", 0) or 0),
            "estimatedWalkToMtrMin": int(row.get("estimatedWalkToMtrMin", 0) or 0),
            "estimatedWalkToMallMin": int(row.get("estimatedWalkToMallMin", 0) or 0),
            "nearestMtrStation": str(row.get("nearestMtrStation", "")),
            "nearestShoppingMall": str(row.get("nearestShoppingMall", "")),
        }
        if developer_lookup and name in developer_lookup:
            dev_info = developer_lookup[name]
            entry["developer"] = dev_info.get("developer", "")
            entry["managementCompany"] = dev_info.get("managementCompany", "")
        lookup[name] = entry

    return lookup


def match_building_to_estate(building_name: str, estate_lookup: dict):
    name = str(building_name).strip()
    if name in estate_lookup:
        return estate_lookup[name]
    for estate_name, data in estate_lookup.items():
        if name.startswith(estate_name + " ") or name.startswith(
            estate_name + "\u3000"
        ):
            return data
    return None


def enrich_with_estate_features(df: pd.DataFrame, estate_lookup: dict):
    building_estate_info = {}
    age_col = []
    mtr_col = []
    mall_col = []
    matched = 0

    for _, row in df.iterrows():
        building = str(row.get("building", ""))
        district = str(row.get("district", ""))
        estate = match_building_to_estate(building, estate_lookup)
        if estate:
            age_col.append(estate["maxBuildingAge"])
            mtr_col.append(estate["estimatedWalkToMtrMin"])
            mall_col.append(estate["estimatedWalkToMallMin"])
            building_estate_info[f"{building}||{district}"] = estate
            matched += 1
        else:
            age_col.append(None)
            mtr_col.append(None)
            mall_col.append(None)

    df = df.copy()
    df["_building_age"] = age_col
    df["_walk_to_mtr"] = mtr_col
    df["_walk_to_mall"] = mall_col

    district_defaults = {}
    for district in df["district"].unique():
        d_rows = df[df["district"] == district]
        d_age = d_rows["_building_age"].dropna()
        d_mtr = d_rows["_walk_to_mtr"].dropna()
        d_mall = d_rows["_walk_to_mall"].dropna()
        district_defaults[district] = {
            "buildingAge": int(d_age.median()) if len(d_age) > 0 else 25,
            "walkToMtrMin": int(d_mtr.median()) if len(d_mtr) > 0 else 20,
            "walkToMallMin": int(d_mall.median()) if len(d_mall) > 0 else 15,
        }

    for idx, row in df.iterrows():
        district = row["district"]
        defaults = district_defaults.get(
            district, {"buildingAge": 25, "walkToMtrMin": 20, "walkToMallMin": 15}
        )
        if pd.isna(row["_building_age"]):
            df.at[idx, "_building_age"] = defaults["buildingAge"]
        if pd.isna(row["_walk_to_mtr"]):
            df.at[idx, "_walk_to_mtr"] = defaults["walkToMtrMin"]
        if pd.isna(row["_walk_to_mall"]):
            df.at[idx, "_walk_to_mall"] = defaults["walkToMallMin"]

    df["_building_age"] = df["_building_age"].astype(int)
    df["_walk_to_mtr"] = df["_walk_to_mtr"].astype(int)
    df["_walk_to_mall"] = df["_walk_to_mall"].astype(int)

    total = len(df)
    print(f"  Estate-matched: {matched}/{total} ({matched / total * 100:.1f}%)")
    print(f"  District-defaulted: {total - matched}/{total}")

    return df, district_defaults, building_estate_info


# ── Floor Level Parsing ────────────────────────────────────────

# ── Floor Level Parsing ────────────────────────────────────────


def parse_floor_level(floor: str, floor_zone: str) -> int:
    """Parse floor level into 0=low, 1=mid, 2=high."""
    if floor_zone:
        if re.search(r"地下|低層", floor_zone):
            return 0
        if re.search(r"中層", floor_zone):
            return 1
        if re.search(r"高層", floor_zone):
            return 2
    if floor:
        m = re.search(r"(\d+)", floor)
        if m:
            n = int(m.group(1))
            if n <= 5:
                return 0
            if n <= 20:
                return 1
            return 2
    return 1  # default mid


def parse_rooms(val: str) -> float:
    """Parse rooms field to number."""
    if not val or str(val).strip() == "":
        return 2.0
    t = str(val).strip()
    if t in ("开放式", "0"):
        return 0.0
    try:
        n = float(t)
        return max(0.0, min(5.0, n))
    except ValueError:
        return 2.0


def is_parking(row: dict) -> bool:
    """Check if a record is a parking space."""
    if row.get("property_type") == "parking":
        return True
    building = str(row.get("building", ""))
    if "車位" in building or "车位" in building:
        return True
    return False


# ── Data Loading & Cleaning ────────────────────────────────────


def load_and_clean_sale_data(csv_path: str) -> pd.DataFrame:
    """Load and clean sale data."""
    print(f"Reading sale data from {csv_path}...")
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    print(f"  Parsed {len(df)} raw sale records")

    # Filter: residential, non-parking, has building & district
    df = df[df["property_type"] == "residential"].copy()
    df = df[df["building"].notna() & (df["building"] != "")].copy()
    df = df[df["district"].notna() & (df["district"] != "")].copy()

    # Filter out parking
    mask = ~df.apply(
        lambda r: is_parking(r.to_dict() if isinstance(r, pd.Series) else r), axis=1
    )
    # Simple parking filter
    df = df[~df["building"].str.contains("車位|车位", na=False)].copy()

    # Validate price and area
    df = df[(df["price"] > 0) & (df["area_sqft"] > 0)].copy()
    df = df[df["price"] >= 500_000].copy()  # skip suspiciously low

    # Compute unit price
    df["price_per_sft"] = np.where(
        df["unit_price"] > 0,
        df["unit_price"],
        df["price"] / df["area_sqft"],
    )
    df = df[df["price_per_sft"] > 0].copy()

    # Parse features
    df["floor_level"] = df.apply(
        lambda r: parse_floor_level(
            str(r.get("floor", "")), str(r.get("floor_zone", ""))
        ),
        axis=1,
    )
    df["rooms"] = df["rooms"].apply(parse_rooms)
    df["log_area"] = np.log(df["area_sqft"].clip(lower=1))
    df["log_price_per_sft"] = np.log(df["price_per_sft"])

    print(f"  Cleaned sale data: {len(df)} training samples")
    return df


def load_and_clean_rent_data(csv_path: str) -> pd.DataFrame:
    """Load and clean rent data."""
    print(f"Reading rent data from {csv_path}...")
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    print(f"  Parsed {len(df)} raw rent records")

    df = df[df["building"].notna() & (df["building"] != "")].copy()
    df = df[df["district"].notna() & (df["district"] != "")].copy()
    df = df[(df["price"] > 0) & (df["area_sqft"] > 0)].copy()
    df = df[~df["building"].str.contains("車位|车位", na=False)].copy()

    df["rent_per_sft"] = df["price"] / df["area_sqft"]
    return df


# ── Feature Engineering ────────────────────────────────────────


def compute_target_encodings(sale_df: pd.DataFrame) -> dict:
    """Compute target encoding for districts and buildings."""
    # District-level target encoding
    district_enc = sale_df.groupby("district")["log_price_per_sft"].mean().to_dict()

    # Building-level target encoding (building||district key)
    sale_df["_bkey"] = sale_df["building"] + "||" + sale_df["district"]
    building_enc = sale_df.groupby("_bkey")["log_price_per_sft"].mean().to_dict()

    return district_enc, building_enc


def build_features(
    df: pd.DataFrame, district_enc: dict, building_enc: dict
) -> pd.DataFrame:
    df = df.copy()

    df["district_enc"] = (
        df["district"].map(district_enc).fillna(district_enc.get("__mean__", 0))
    )

    df["_bkey"] = df["building"] + "||" + df["district"]
    df["building_enc"] = df["_bkey"].map(building_enc).fillna(0)

    df["building_age"] = df["_building_age"]
    df["walk_to_mtr"] = df["_walk_to_mtr"]
    df["walk_to_mall"] = df["_walk_to_mall"]

    return df


# ── Compute Building/District Statistics ────────────────────────


def compute_statistics(
    sale_df: pd.DataFrame,
    rent_df: pd.DataFrame,
    district_vocab: list[str],
) -> dict:
    """Compute building-level and district-level statistics for the frontend."""
    # Sale stats
    sale_df["_bkey"] = sale_df["building"] + "||" + sale_df["district"]
    sale_building = (
        sale_df.groupby(["district", "_bkey", "building"])
        .agg(
            avg_sale_per_sft=("price_per_sft", "mean"),
            sale_count=("price_per_sft", "count"),
        )
        .reset_index()
    )

    # Rent stats
    rent_df["_bkey"] = rent_df["building"] + "||" + rent_df["district"]
    rent_building = (
        rent_df.groupby(["district", "_bkey"])
        .agg(
            avg_rent_per_sft=("rent_per_sft", "mean"),
            rent_count=("rent_per_sft", "count"),
        )
        .reset_index()
    )

    # District rent averages (fallback)
    district_rent = (
        rent_df.groupby("district")
        .agg(
            avg_rent_per_sft=("rent_per_sft", "mean"),
            rent_count=("rent_per_sft", "count"),
        )
        .to_dict("index")
    )

    # Merge
    rent_lookup = {row["_bkey"]: row.to_dict() for _, row in rent_building.iterrows()}

    districts_data = []
    for code in district_vocab:
        d_sales = sale_building[sale_building["district"] == code]
        buildings = []
        for _, row in d_sales.iterrows():
            bkey = row["_bkey"]
            rent_info = rent_lookup.get(bkey)
            d_rent = district_rent.get(code)

            avg_rent = 0.0
            rent_count = 0
            if rent_info is not None and rent_info["rent_count"] >= 3:
                avg_rent = round(float(rent_info["avg_rent_per_sft"]), 1)
                rent_count = int(rent_info["rent_count"])
            elif d_rent is not None and d_rent["rent_count"] >= 3:
                avg_rent = round(float(d_rent["avg_rent_per_sft"]), 1)
                rent_count = int(d_rent["rent_count"])

            if row["sale_count"] >= 5:
                buildings.append(
                    {
                        "name": row["building"],
                        "avgSalePerSft": round(row["avg_sale_per_sft"]),
                        "avgRentPerSft": avg_rent,
                        "saleCount": int(row["sale_count"]),
                        "rentCount": rent_count,
                    }
                )

        buildings.sort(key=lambda b: b["saleCount"], reverse=True)
        districts_data.append({"code": code, "buildings": buildings})

    return districts_data


# ── Train XGBoost ──────────────────────────────────────────────

FEATURE_NAMES = [
    "log_area",
    "floor_level",
    "rooms",
    "district_enc",
    "building_enc",
    "building_age",
    "walk_to_mtr",
    "walk_to_mall",
]


def train_xgboost(df: pd.DataFrame) -> tuple:
    """Train XGBoost model and return (model, rmse, mae, feature_importance)."""
    X = df[FEATURE_NAMES].values.astype(np.float32)
    y = df["log_price_per_sft"].values.astype(np.float32)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.1, random_state=42
    )

    print(f"\nTraining XGBoost model...")
    print(f"  Train: {len(X_train)}, Test: {len(X_test)}")
    print(f"  Features: {FEATURE_NAMES}")

    model = xgb.XGBRegressor(
        n_estimators=500,
        max_depth=8,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=10,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
        early_stopping_rounds=20,
    )

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_test, y_test)],
        verbose=50,
    )

    # Evaluate
    y_pred = model.predict(X_test)
    rmse_log = math.sqrt(mean_squared_error(y_test, y_pred))
    mae_log = mean_absolute_error(y_test, y_pred)

    # Convert to actual price space
    y_actual = np.exp(y_test)
    y_pred_actual = np.exp(y_pred)
    rmse_actual = math.sqrt(mean_squared_error(y_actual, y_pred_actual))
    mae_actual = mean_absolute_error(y_actual, y_pred_actual)

    print(f"\n── Test Set Performance ──")
    print(f"  RMSE (log space):     {rmse_log:.6f}")
    print(f"  MAE  (log space):     {mae_log:.6f}")
    print(f"  RMSE (HK$/sqft):      HK${rmse_actual:.0f}")
    print(f"  MAE  (HK$/sqft):      HK${mae_actual:.0f}")

    # Feature importance
    importance = model.feature_importances_
    print(f"\n── Feature Importance ──")
    for name, imp in sorted(zip(FEATURE_NAMES, importance), key=lambda x: -x[1]):
        print(f"  {name:20s}: {imp:.4f}")

    return model, rmse_actual, mae_actual, dict(zip(FEATURE_NAMES, importance.tolist()))


# ── Export to ONNX ──────────────────────────────────────────────


def export_onnx(model, output_path: str):
    """Export XGBoost model to ONNX format."""
    try:
        from onnxmltools import convert_xgboost as convert_xgb
        from onnxconverter_common.data_types import FloatTensorType
    except ImportError:
        print("\n[ERROR] onnxmltools not installed. Install with:")
        print("  pip install onnxmltools onnxconverter-common")
        sys.exit(1)

    print(f"\nExporting ONNX model to {output_path}...")

    initial_type = [("float_input", FloatTensorType([None, len(FEATURE_NAMES)]))]
    onnx_model = convert_xgb(model, initial_types=initial_type)

    # Set model metadata
    onnx_model.model_version = 1
    onnx_model.doc_string = "HK Property Sale Price XGBoost Model"
    onnx_model.producer_name = "hk-buy-or-rent"

    # Optimize: set opset version
    try:
        from onnx import set_model_version

        set_model_version(onnx_model, 17)
    except Exception:
        pass

    with open(output_path, "wb") as f:
        f.write(onnx_model.SerializeToString())

    size_kb = os.path.getsize(output_path) / 1024
    print(f"  ONNX model size: {size_kb:.1f} KB")


# ── Main ───────────────────────────────────────────────────────


def main():
    print("=== HK Property XGBoost Model Training ===\n")

    os.makedirs(PUBLIC_DIR, exist_ok=True)

    # 1. Load data
    sale_df = load_and_clean_sale_data(SALE_CSV)
    rent_df = load_and_clean_rent_data(RENT_CSV)

    # 2. Load estate data and enrich
    estate_df = load_estate_data(ESTATE_CSV)
    developer_lookup = load_developer_data(DEVELOPER_CSV)
    estate_lookup = build_estate_lookup(estate_df, developer_lookup)
    print(f"  Estate lookup: {len(estate_lookup)} estates")
    sale_df, district_defaults, building_estate_info = enrich_with_estate_features(
        sale_df, estate_lookup
    )

    # 3. Build district vocabulary
    district_vocab = sorted(sale_df["district"].unique().tolist())
    print(f"\nDistricts with sale data: {len(district_vocab)}")

    unique_buildings = sale_df.groupby(["building", "district"]).ngroups
    print(f"Unique building-district combos: {unique_buildings}")

    # 4. Feature engineering
    print("\nComputing target encodings...")
    district_enc, building_enc = compute_target_encodings(sale_df)

    district_enc["__mean__"] = sale_df["log_price_per_sft"].mean()

    sale_df = build_features(sale_df, district_enc, building_enc)

    # Feature distribution analysis
    print("\n── Feature Distributions ──")
    for feat in FEATURE_NAMES:
        vals = sale_df[feat]
        print(
            f"  {feat:20s}: mean={vals.mean():.4f}, std={vals.std():.4f}, "
            f"min={vals.min():.4f}, max={vals.max():.4f}"
        )

    # 5. Train model
    model, rmse, mae, feature_importance = train_xgboost(sale_df)

    # 6. Export to ONNX
    export_onnx(model, ONNX_OUTPUT)

    # 7. Compute building/district statistics
    print("\nComputing building/district statistics...")
    districts_data = compute_statistics(sale_df, rent_df, district_vocab)
    total_buildings = sum(len(d["buildings"]) for d in districts_data)
    print(f"  Total districts: {len(districts_data)}")
    print(f"  Total buildings with stats: {total_buildings}")

    # 8. Build district encoding lookup for frontend
    district_enc_lookup = {}
    for code in district_vocab:
        district_enc_lookup[code] = round(
            district_enc.get(code, district_enc["__mean__"]), 6
        )

    # 9. Build building encoding lookup
    building_enc_lookup = {}
    for bkey, val in building_enc.items():
        building_enc_lookup[bkey] = round(val, 6)

    # 10. Build building estate info for frontend (for auto-fill)
    building_estate_frontend = {}
    for bkey, info in building_estate_info.items():
        building_estate_frontend[bkey] = {
            "buildingAge": info["maxBuildingAge"],
            "walkToMtrMin": info["estimatedWalkToMtrMin"],
            "walkToMallMin": info["estimatedWalkToMallMin"],
            "nearestMtrStation": info["nearestMtrStation"],
            "nearestShoppingMall": info["nearestShoppingMall"],
            "developer": info.get("developer", ""),
            "managementCompany": info.get("managementCompany", ""),
        }

    # 11. Write metadata JSON
    meta = {
        "modelType": "xgboost",
        "featureNames": FEATURE_NAMES,
        "districtEncoding": district_enc_lookup,
        "buildingEncoding": building_enc_lookup,
        "districts": districts_data,
        "districtDefaults": district_defaults,
        "buildingEstateInfo": building_estate_frontend,
        "floorLevels": ["low", "mid", "high"],
        "roomOptions": [
            {"value": 0, "label": {"en": "Studio", "zh": "开放式", "tc": "開放式"}},
            {"value": 1, "label": {"en": "1-room", "zh": "1房", "tc": "1房"}},
            {"value": 2, "label": {"en": "2-room", "zh": "2房", "tc": "2房"}},
            {"value": 3, "label": {"en": "3-room", "zh": "3房", "tc": "3房"}},
            {"value": 4, "label": {"en": "4-room", "zh": "4房", "tc": "4房"}},
        ],
        "trainingMeta": {
            "saleSamples": len(sale_df),
            "rentSamples": len(rent_df),
            "nDistricts": len(district_vocab),
            "nBuildings": total_buildings,
            "saleRmse": round(rmse),
            "saleMae": round(mae),
            "featureImportance": feature_importance,
        },
        "logRmseApprox": round(0.15, 3),
    }

    with open(META_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"\n[OK] Metadata written to {META_OUTPUT}")

    meta_size_kb = os.path.getsize(META_OUTPUT) / 1024
    print(f"  Metadata size: {meta_size_kb:.1f} KB")
    print(f"\nModel RMSE: HK${rmse:.0f}/sqft")
    print(f"Model MAE:  HK${mae:.0f}/sqft")

    # 12. Generate districtCodes.ts for synchronous import
    codes_ts_lines = [
        "// Auto-generated by scripts/train_model.py — DO NOT EDIT",
        f"// {len(district_vocab)} districts",
        "",
        "export const DISTRICT_CODES: string[] = [",
    ]
    for code in district_vocab:
        codes_ts_lines.append(f'  "{code}",')
    codes_ts_lines.append("];")
    codes_ts_lines.append("")

    os.makedirs(SRC_LIB_DIR, exist_ok=True)
    with open(DISTRICT_CODES_OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(codes_ts_lines))
    print(f"\n[OK] District codes written to {DISTRICT_CODES_OUTPUT}")

    print(f"\nDone.")


if __name__ == "__main__":
    main()
