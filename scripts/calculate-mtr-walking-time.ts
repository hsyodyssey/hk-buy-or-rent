/**
 * Calculate walking time from each estate to nearest MTR station and shopping mall
 * using Haversine distance from coordinates in mapinfo data.
 *
 * Usage: npx tsx scripts/calculate-mtr-walking-time.ts
 *
 * Steps:
 *   1. Read each mapinfo JSON from private_data/mapinfo/
 *   2. Extract MTR station coordinates from transportInfo.mtrGeoJson
 *   3. Extract shopping mall coordinates from shoppingMallInfo.geoJson
 *   4. For each estate in estateResult.data, find nearest MTR station & shopping mall
 *   5. Calculate Haversine distance, estimate walking time
 *   6. Output enriched CSV to private_data/centanet_estate_mtr.csv
 *
 * Walking time estimation:
 *   - Walking speed: 5 km/h
 *   - Detour factor: 1.35 (straight-line vs actual walking path)
 *   - walkMin = distance_km / 5 * 60 * 1.35
 */

import * as fs from "fs";
import * as path from "path";

// ── Paths ──────────────────────────────────────────────────────

const MAPINFO_DIR = path.join(__dirname, "..", "private_data", "mapinfo");
const ESTATE_CSV = path.join(
  __dirname,
  "..",
  "private_data",
  "centanet_estate_data.csv"
);
const OUTPUT_CSV = path.join(
  __dirname,
  "..",
  "private_data",
  "centanet_estate_mtr.csv"
);

// ── Haversine ──────────────────────────────────────────────────

const R_EARTH = 6_371_000; // meters

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_EARTH * c; // meters
}

function estimateWalkMinutes(distanceMeters: number): number {
  const speedKmh = 5;
  const detourFactor = 1.35;
  const distanceKm = distanceMeters / 1000;
  return Math.round((distanceKm / speedKmh) * 60 * detourFactor);
}

// ── Types ──────────────────────────────────────────────────────

interface MtrStation {
  stationName: string;
  lat: number;
  lng: number;
  routes: string[];
}

interface ShoppingMall {
  name: string;
  lat: number;
  lng: number;
}

interface EstateMtrRow {
  hmaId: string;
  hmaName: string;
  estateNameHK: string;
  estateNameEN: string;
  typeCode: string;
  minBuildingAge: number;
  maxBuildingAge: number;
  lat: number;
  lng: number;
  address: string;
  district: string;
  market: string;
  canKeepPet: boolean;
  phaseCount: number;
  buildingCount: number;
  unitCount: number;
  saleUnitPrice: number;
  saleTrend: number;
  salePostCount: number;
  saleTxCount: number;
  rentPostCount: number;
  nearestMtrStation: string;
  nearestMtrRoutes: string;
  distanceToMtrMeters: number;
  estimatedWalkToMtrMin: number;
  nearestShoppingMall: string;
  distanceToMallMeters: number;
  estimatedWalkToMallMin: number;
}

// ── Extract MTR stations from a mapinfo JSON ───────────────────

function extractMtrStations(apiData: any): MtrStation[] {
  const features = apiData?.transportInfo?.mtrGeoJson?.features;
  if (!Array.isArray(features)) return [];

  return features
    .map((f: any) => {
      const coords = f?.geometry?.coordinates;
      const props = f?.properties;
      if (!coords || !props) return null;
      return {
        stationName: props.stationName || "",
        lat: coords[1],
        lng: coords[0],
        routes: (props.routes || []).map((r: any) => r.routeName || "").filter(Boolean),
      };
    })
    .filter(Boolean) as MtrStation[];
}

function extractShoppingMalls(apiData: any): ShoppingMall[] {
  const features = apiData?.shoppingMallInfo?.geoJson?.features;
  if (!Array.isArray(features)) return [];

  return features
    .map((f: any) => {
      const coords = f?.geometry?.coordinates;
      const props = f?.properties;
      if (!coords || !props) return null;
      return {
        name: props.name || "",
        lat: coords[1],
        lng: coords[0],
      };
    })
    .filter(Boolean) as ShoppingMall[];
}

// ── CSV helpers ────────────────────────────────────────────────

function escapeCsv(val: any): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── Main ───────────────────────────────────────────────────────

function main() {
  console.log("=== Calculate MTR Walking Time & Shopping Mall Distance ===\n");

  console.log("Building global MTR station & shopping mall index...");

  const allStations: MtrStation[] = [];
  const allMalls: ShoppingMall[] = [];
  const files = fs.readdirSync(MAPINFO_DIR).filter((f) => f.endsWith(".json"));
  const stationNameSet = new Set<string>();
  const mallNameSet = new Set<string>();

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(MAPINFO_DIR, file), "utf-8");
      const data = JSON.parse(raw);
      if (data.error) continue;

      for (const s of extractMtrStations(data)) {
        if (!stationNameSet.has(s.stationName)) {
          stationNameSet.add(s.stationName);
          allStations.push(s);
        }
      }

      for (const m of extractShoppingMalls(data)) {
        if (!mallNameSet.has(m.name)) {
          mallNameSet.add(m.name);
          allMalls.push(m);
        }
      }
    } catch {
      // skip
    }
  }

  console.log(`Found ${allStations.length} unique MTR stations across all HMAs`);
  console.log(`Found ${allMalls.length} unique shopping malls across all HMAs\n`);

  console.log("Processing estates...");

  const allRows: EstateMtrRow[] = [];
  let estateWithMtr = 0;
  let estateWithoutCoords = 0;

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(MAPINFO_DIR, file), "utf-8");
      const data = JSON.parse(raw);
      if (data.error) continue;

      const estates = data?.estateResult?.data;
      if (!Array.isArray(estates)) continue;

      const hmaId = file.replace(".json", "");

      for (const e of estates) {
        const lat = e.gMap?.lat ?? 0;
        const lng = e.gMap?.lng ?? 0;

        let nearestStation = "";
        let nearestRoutes = "";
        let minDistMtr = Infinity;
        let walkMinMtr = 0;

        let nearestMall = "";
        let minDistMall = Infinity;
        let walkMinMall = 0;

        if (lat !== 0 && lng !== 0) {
          for (const s of allStations) {
            const d = haversine(lat, lng, s.lat, s.lng);
            if (d < minDistMtr) {
              minDistMtr = d;
              nearestStation = s.stationName;
              nearestRoutes = s.routes.join("/");
            }
          }
          if (minDistMtr !== Infinity) {
            walkMinMtr = estimateWalkMinutes(minDistMtr);
            estateWithMtr++;
          }

          for (const m of allMalls) {
            const d = haversine(lat, lng, m.lat, m.lng);
            if (d < minDistMall) {
              minDistMall = d;
              nearestMall = m.name;
            }
          }
          if (minDistMall !== Infinity) {
            walkMinMall = estimateWalkMinutes(minDistMall);
          }
        } else {
          estateWithoutCoords++;
        }

        allRows.push({
          hmaId,
          hmaName: e.scope?.hma || "",
          estateNameHK: e.estateNameHK || "",
          estateNameEN: e.estateNameEN || "",
          typeCode: e.typeCode || "",
          minBuildingAge: e.minBuildingAge ?? 0,
          maxBuildingAge: e.maxBuildingAge ?? 0,
          lat,
          lng,
          address: e.address || "",
          district: e.scope?.db || "",
          market: e.scope?.scp_mkt || "",
          canKeepPet: !!e.canKeepPet,
          phaseCount: e.phaseCount ?? 0,
          buildingCount: e.buildingCount ?? 0,
          unitCount: e.unitCount ?? 0,
          saleUnitPrice: e.sale?.nUnitPrice ?? 0,
          saleTrend: e.sale?.nTrend ?? 0,
          salePostCount: e.sale?.postCount ?? 0,
          saleTxCount: e.sale?.transactionCount ?? 0,
          rentPostCount: e.rent?.postCount ?? 0,
          nearestMtrStation: nearestStation,
          nearestMtrRoutes: nearestRoutes,
          distanceToMtrMeters: minDistMtr === Infinity ? 0 : Math.round(minDistMtr),
          estimatedWalkToMtrMin: walkMinMtr,
          nearestShoppingMall: nearestMall,
          distanceToMallMeters: minDistMall === Infinity ? 0 : Math.round(minDistMall),
          estimatedWalkToMallMin: walkMinMall,
        });
      }
    } catch {
      // skip malformed files
    }
  }

  console.log(`Processed ${allRows.length} estates total`);
  console.log(`  With MTR data: ${estateWithMtr}`);
  console.log(`  Without coords: ${estateWithoutCoords}\n`);

  const headers = Object.keys(allRows[0] || {}) as (keyof EstateMtrRow)[];
  const csvLines = [
    headers.join(","),
    ...allRows.map((row) =>
      headers.map((h) => escapeCsv(row[h])).join(",")
    ),
  ];

  fs.writeFileSync(OUTPUT_CSV, csvLines.join("\n"), "utf-8");
  console.log(`CSV written to ${OUTPUT_CSV}`);

  const withMtr = allRows.filter((r) => r.nearestMtrStation !== "");
  const withMall = allRows.filter((r) => r.nearestShoppingMall !== "");

  if (withMtr.length > 0) {
    const distances = withMtr.map((r) => r.distanceToMtrMeters);
    const walkTimes = withMtr.map((r) => r.estimatedWalkToMtrMin);
    console.log("\n--- MTR Distance Stats ---");
    console.log(
      `Distance to MTR: min=${Math.min(...distances)}m, ` +
        `max=${Math.max(...distances)}m, ` +
        `avg=${Math.round(distances.reduce((a, b) => a + b, 0) / distances.length)}m`
    );
    console.log(
      `Walk time:       min=${Math.min(...walkTimes)}min, ` +
        `max=${Math.max(...walkTimes)}min, ` +
        `avg=${Math.round(walkTimes.reduce((a, b) => a + b, 0) / walkTimes.length)}min`
    );

    const buckets: [number, number][] = [
      [0, 5], [5, 10], [10, 15], [15, 20], [20, 30], [30, 60], [60, Infinity],
    ];
    console.log("\nMTR walk time distribution:");
    for (const [lo, hi] of buckets) {
      const count = walkTimes.filter((t) => t >= lo && t < hi).length;
      const pct = ((count / walkTimes.length) * 100).toFixed(1);
      const label = hi === Infinity ? `${lo}+ min` : `${lo}-${hi} min`;
      console.log(`  ${label.padEnd(12)} ${count.toString().padStart(5)} (${pct}%)`);
    }
  }

  if (withMall.length > 0) {
    const distances = withMall.map((r) => r.distanceToMallMeters);
    const walkTimes = withMall.map((r) => r.estimatedWalkToMallMin);
    console.log("\n--- Shopping Mall Distance Stats ---");
    console.log(
      `Distance to mall: min=${Math.min(...distances)}m, ` +
        `max=${Math.max(...distances)}m, ` +
        `avg=${Math.round(distances.reduce((a, b) => a + b, 0) / distances.length)}m`
    );
    console.log(
      `Walk time:        min=${Math.min(...walkTimes)}min, ` +
        `max=${Math.max(...walkTimes)}min, ` +
        `avg=${Math.round(walkTimes.reduce((a, b) => a + b, 0) / walkTimes.length)}min`
    );

    const buckets: [number, number][] = [
      [0, 5], [5, 10], [10, 15], [15, 20], [20, 30], [30, 60], [60, Infinity],
    ];
    console.log("\nMall walk time distribution:");
    for (const [lo, hi] of buckets) {
      const count = walkTimes.filter((t) => t >= lo && t < hi).length;
      const pct = ((count / walkTimes.length) * 100).toFixed(1);
      const label = hi === Infinity ? `${lo}+ min` : `${lo}-${hi} min`;
      console.log(`  ${label.padEnd(12)} ${count.toString().padStart(5)} (${pct}%)`);
    }
  }

  console.log("\nDone.");
}

main();
