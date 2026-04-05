"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  FLOOR_LEVELS,
  ROOM_OPTIONS,
  estimatePrice,
  preloadModel,
  getDistricts,
  getTrainingMeta,
  getBuildingsForDistrict,
  getBuildingEstateInfo,
  getDistrictDefaults,
  type PriceEstimateResult,
  type BuildingOption,
} from "@/lib/priceModel";
import { formatHKD, formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/hooks/useLanguage";
import RegionSelector from "@/components/RegionSelector";

interface Props {
  onApply: (propertyPrice: number, monthlyRent: number) => void;
}

export default function PriceEstimator({ onApply }: Props) {
  const { t, locale } = useLanguage();

  const [districtIdx, setDistrictIdx] = useState(-1);
  const [buildingName, setBuildingName] = useState("");
  const [floorLevel, setFloorLevel] = useState(1);
  const [saleableArea, setSaleableArea] = useState(400);
  const [rooms, setRooms] = useState(2);
  const [buildingAge, setBuildingAge] = useState(20);
  const [walkToMtrMin, setWalkToMtrMin] = useState(15);
  const [walkToMallMin, setWalkToMallMin] = useState(10);
  const [result, setResult] = useState<PriceEstimateResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    preloadModel()
      .then(() => setModelReady(true))
      .catch((err) => {
        console.error("[estimator] preload failed:", err);
      });
  }, []);

  const districts = useMemo(() => getDistricts(), [modelReady]);
  const trainingMeta = useMemo(() => getTrainingMeta(), [modelReady]);

  const buildingOptions: BuildingOption[] = useMemo(
    () => getBuildingsForDistrict(districtIdx),
    [districtIdx, modelReady]
  );

  const floorLabels = [
    t("estimator.floorLow"),
    t("estimator.floorMid"),
    t("estimator.floorHigh"),
  ];

  const roomLabelMap = useMemo(
    () =>
      ROOM_OPTIONS.map((opt) => {
        if (locale === "zh" || locale === "tc") return opt.label[locale];
        return opt.label.en;
      }),
    [locale]
  );

  function handleDistrictChange(idx: number) {
    setDistrictIdx(idx);
    setBuildingName("");
    setResult(null);
    setApplied(false);
    setError(null);

    const dd = getDistrictDefaults(idx);
    if (dd) {
      setBuildingAge(dd.buildingAge);
      setWalkToMtrMin(dd.walkToMtrMin);
      setWalkToMallMin(dd.walkToMallMin);
    } else {
      setBuildingAge(25);
      setWalkToMtrMin(20);
      setWalkToMallMin(15);
    }
  }

  function handleBuildingChange(name: string) {
    setBuildingName(name);
    setResult(null);

    if (name && districtIdx >= 0) {
      const info = getBuildingEstateInfo(districtIdx, name);
      if (info) {
        setBuildingAge(info.buildingAge);
        setWalkToMtrMin(info.walkToMtrMin);
        setWalkToMallMin(info.walkToMallMin);
      }
    } else if (districtIdx >= 0) {
      const dd = getDistrictDefaults(districtIdx);
      if (dd) {
        setBuildingAge(dd.buildingAge);
        setWalkToMtrMin(dd.walkToMtrMin);
        setWalkToMallMin(dd.walkToMallMin);
      }
    }
  }

  const currentEstateInfo = useMemo(() => {
    if (!buildingName || districtIdx < 0) return null;
    return getBuildingEstateInfo(districtIdx, buildingName);
  }, [districtIdx, buildingName, modelReady]);

  const handleEstimate = useCallback(async () => {
    if (districtIdx < 0) return;
    setLoading(true);
    setError(null);

    try {
      const r = await estimatePrice(
        { districtIdx, floorLevel, saleableArea, rooms, buildingAge, walkToMtrMin, walkToMallMin },
        buildingName || undefined
      );
      setResult(r);
      setApplied(false);
    } catch (err) {
      console.error("[estimator] error:", err);
      setError(err instanceof Error ? err.message : "Prediction failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [districtIdx, buildingName, floorLevel, saleableArea, rooms, buildingAge, walkToMtrMin, walkToMallMin]);

  function handleApply() {
    if (!result) return;
    onApply(result.estimatedPrice, result.estimatedMonthlyRent);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }

  const selectedDistrict = districtIdx >= 0 ? districts[districtIdx] : null;

  return (
    <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-800">
          {t("estimator.title")}
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          {t("estimator.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Left: Scrollable Input Controls (3/5 width) */}
        <div className="md:col-span-3 max-h-[70vh] overflow-y-auto pr-2 space-y-5 scrollbar-thin">
          {/* Location */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-teal-600 mb-2">
              {t("estimator.location")}
            </label>
            <div className="space-y-1.5">
              <RegionSelector onSelect={handleDistrictChange} selectedIdx={districtIdx} />
              {selectedDistrict && (
                <p className="text-xs text-teal-600 font-medium">
                  ✓ {selectedDistrict.code}
                  {buildingOptions.length > 0 &&
                    ` · ${buildingOptions.length}${t("estimator.buildingCount")}`}
                </p>
              )}
            </div>
          </div>

          {/* Building (optional) */}
          {districtIdx >= 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-teal-600 mb-2">
                {t("estimator.building")}
                <span className="ml-1 text-zinc-400 normal-case font-normal">
                  {t("estimator.optional")}
                </span>
              </label>
              <select
                value={buildingName}
                onChange={(e) => handleBuildingChange(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-zinc-800 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
              >
                <option value="">{t("estimator.buildingPlaceholder")}</option>
                {buildingOptions.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                    {b.avgRentPerSft > 0
                      ? ` (${b.saleCount}${t("estimator.txCount")} / ${t("estimator.rentAvail")})`
                      : ` (${b.saleCount}${t("estimator.txCount")})`}
                  </option>
                ))}
              </select>
              {buildingName && (
                <p className="text-xs text-teal-600 mt-1">
                  {(() => {
                    const b = buildingOptions.find((x) => x.name === buildingName);
                    if (!b) return null;
                    return (
                      <>
                        {t("estimator.saleAvg")} HK${b.avgSalePerSft.toLocaleString()}/ft²
                        {b.avgRentPerSft > 0 &&
                          ` · ${t("estimator.rentAvgLabel")} HK$${b.avgRentPerSft.toFixed(1)}/ft²/mo`}
                      </>
                    );
                  })()}
                </p>
              )}
            </div>
          )}

          {/* Developer & Management (display only, from estate info) */}
          {currentEstateInfo && (currentEstateInfo.developer || currentEstateInfo.managementCompany) && (
            <div className="rounded-lg bg-amber-50/60 border border-amber-200/50 px-4 py-3 space-y-1.5">
              {currentEstateInfo.developer && (
                <div className="flex justify-between text-xs">
                  <span className="text-amber-600">{t("estimator.developer")}</span>
                  <span className="font-medium text-amber-800 text-right max-w-[60%]">
                    {currentEstateInfo.developer}
                  </span>
                </div>
              )}
              {currentEstateInfo.managementCompany && (
                <div className="flex justify-between text-xs">
                  <span className="text-amber-600">{t("estimator.managementCompany")}</span>
                  <span className="font-medium text-amber-800 text-right max-w-[60%]">
                    {currentEstateInfo.managementCompany}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Floor level */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-teal-600 mb-2">
              {t("estimator.floorLevel")}
            </label>
            <div className="flex gap-2">
              {FLOOR_LEVELS.map((level, i) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFloorLevel(i)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    floorLevel === i
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-stone-200 bg-white text-zinc-500 hover:border-stone-300"
                  }`}
                >
                  {floorLabels[i]}
                </button>
              ))}
            </div>
          </div>

          {/* Saleable area */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-teal-600 mb-2">
              {t("estimator.area")}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={100}
                max={2000}
                step={10}
                value={saleableArea}
                onChange={(e) => setSaleableArea(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none bg-stone-200 accent-teal-500"
              />
              <span className="text-sm font-mono font-semibold text-zinc-700 w-20 text-right">
                {saleableArea} ft²
              </span>
            </div>
          </div>

          {/* Rooms */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-teal-600 mb-2">
              {t("estimator.rooms")}
            </label>
            <div className="flex gap-2">
              {ROOM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRooms(opt.value)}
                  className={`flex-1 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                    rooms === opt.value
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-stone-200 bg-white text-zinc-500 hover:border-stone-300"
                  }`}
                >
                  {roomLabelMap[opt.value]}
                </button>
              ))}
            </div>
          </div>

          {/* Building Age */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-teal-600 mb-2">
              {t("estimator.buildingAge")}
              {currentEstateInfo && (
                <span className="ml-1 text-teal-400 normal-case font-normal text-[10px]">
                  {t("estimator.autoFilled")}
                </span>
              )}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={buildingAge}
                onChange={(e) => setBuildingAge(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none bg-stone-200 accent-teal-500"
              />
              <span className="text-sm font-mono font-semibold text-zinc-700 w-20 text-right">
                {buildingAge} {t("estimator.years")}
              </span>
            </div>
          </div>

          {/* Walk to MTR */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-teal-600 mb-2">
              {t("estimator.walkToMtr")}
              {currentEstateInfo?.nearestMtrStation && (
                <span className="ml-1 text-teal-400 normal-case font-normal text-[10px]">
                  {currentEstateInfo.nearestMtrStation}
                </span>
              )}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={120}
                step={1}
                value={walkToMtrMin}
                onChange={(e) => setWalkToMtrMin(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none bg-stone-200 accent-teal-500"
              />
              <span className="text-sm font-mono font-semibold text-zinc-700 w-20 text-right">
                {walkToMtrMin} {t("estimator.minutes")}
              </span>
            </div>
          </div>

          {/* Walk to Mall */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-teal-600 mb-2">
              {t("estimator.walkToMall")}
              {currentEstateInfo?.nearestShoppingMall && (
                <span className="ml-1 text-teal-400 normal-case font-normal text-[10px]">
                  {currentEstateInfo.nearestShoppingMall}
                </span>
              )}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={60}
                step={1}
                value={walkToMallMin}
                onChange={(e) => setWalkToMallMin(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none bg-stone-200 accent-teal-500"
              />
              <span className="text-sm font-mono font-semibold text-zinc-700 w-20 text-right">
                {walkToMallMin} {t("estimator.minutes")}
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Right: Fixed Results Panel (2/5 width) */}
        <div className="md:col-span-2">
          <div className="md:sticky md:top-24 space-y-4">
            {/* Estimate button - at top of right panel */}
            <button
              type="button"
              onClick={handleEstimate}
              disabled={districtIdx < 0 || loading}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                districtIdx >= 0 && !loading
                  ? "bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
              }`}
            >
              {loading ? "..." : t("estimator.estimate")}
            </button>

            {result ? (
              <>
                <div className="rounded-lg bg-teal-50 border border-teal-100 px-4 py-4 space-y-3">
                  <div>
                    <p className="text-xs text-teal-500">
                      {t("estimator.estimatedPrice")}
                    </p>
                    <p className="text-2xl font-mono font-bold text-teal-800">
                      {formatHKD(result.estimatedPrice, true)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-teal-500">
                        {t("estimator.pricePerSft")}
                      </p>
                      <p className="text-sm font-mono font-semibold text-teal-700">
                        {formatHKD(result.estimatedPricePerSft, true)}
                        {t("estimator.perSft")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-teal-500">
                        {t("estimator.estimatedRent")}
                      </p>
                      <p className="text-sm font-mono font-semibold text-teal-700">
                        {formatHKD(result.estimatedMonthlyRent, true)}/mo
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-teal-500">
                      {t("estimator.priceRange")}
                    </p>
                    <p className="text-sm font-mono text-teal-600">
                      {formatHKD(result.priceRange[0], true)} —{" "}
                      {formatHKD(result.priceRange[1], true)}
                    </p>
                  </div>
                  <div className="border-t border-teal-200/60 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-teal-500">
                        {t("estimator.rentalYield")}
                      </span>
                      <span className="text-xs font-mono text-teal-600">
                        {formatPercent(result.rentalYield)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Property summary */}
                <div className="rounded-lg bg-white border border-stone-200 px-4 py-3 space-y-1.5 text-xs text-zinc-500">
                  <div className="flex justify-between">
                    <span>{t("estimator.location")}</span>
                    <span className="font-medium text-zinc-700">
                      {result.districtCode}
                    </span>
                  </div>
                  {result.buildingName && (
                    <div className="flex justify-between">
                      <span>{t("estimator.building")}</span>
                      <span className="font-medium text-zinc-700 text-right max-w-[60%] truncate">
                        {result.buildingName}
                      </span>
                    </div>
                  )}
                  {currentEstateInfo?.developer && (
                    <div className="flex justify-between">
                      <span>{t("estimator.developer")}</span>
                      <span className="font-medium text-zinc-700 text-right max-w-[60%] truncate">
                        {currentEstateInfo.developer}
                      </span>
                    </div>
                  )}
                  {currentEstateInfo?.managementCompany && (
                    <div className="flex justify-between">
                      <span>{t("estimator.managementCompany")}</span>
                      <span className="font-medium text-zinc-700 text-right max-w-[60%] truncate">
                        {currentEstateInfo.managementCompany}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{t("estimator.floorLevel")}</span>
                    <span className="font-medium text-zinc-700">
                      {floorLabels[floorLevel]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("estimator.area")}</span>
                    <span className="font-medium text-zinc-700">
                      {result.saleableArea} ft²
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("estimator.rooms")}</span>
                    <span className="font-medium text-zinc-700">
                      {roomLabelMap[rooms]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("estimator.buildingAge")}</span>
                    <span className="font-medium text-zinc-700">
                      {buildingAge} {t("estimator.years")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("estimator.walkToMtr")}</span>
                    <span className="font-medium text-zinc-700">
                      {walkToMtrMin} {t("estimator.minutes")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("estimator.walkToMall")}</span>
                    <span className="font-medium text-zinc-700">
                      {walkToMallMin} {t("estimator.minutes")}
                    </span>
                  </div>
                  {result.avgRentPerSft > 0 && (
                    <div className="flex justify-between">
                      <span>{t("estimator.rentSource")}</span>
                      <span className="font-medium text-teal-600">
                        {t("estimator.rentSourceActual")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Apply to calculator */}
                <button
                  type="button"
                  onClick={handleApply}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                    applied
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-teal-500 bg-white text-teal-700 hover:bg-teal-50"
                  }`}
                >
                  {applied ? t("estimator.applied") : t("estimator.applyToCalc")}
                </button>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-stone-300 bg-white px-4 py-12 text-center">
                <p className="text-sm text-zinc-400">
                  {districtIdx < 0
                    ? t("estimator.noDistrict")
                    : t("estimator.noResult")}
                </p>
              </div>
            )}

            {/* Model info */}
            <div className="rounded-lg bg-stone-50 border border-stone-100 px-3 py-2 text-xs text-zinc-400 space-y-1">
              <div className="flex justify-between">
                <span>{t("estimator.rmse")}</span>
                <span className="font-mono">
                  HK${trainingMeta.saleRmse.toLocaleString()}
                  {t("estimator.perSft")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t("estimator.samples")}</span>
                <span className="font-mono">
                  {trainingMeta.saleSamples.toLocaleString()}
                  {" + "}
                  {trainingMeta.rentSamples.toLocaleString()}
                  {t("estimator.rentSuffix")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t("estimator.coverage")}</span>
                <span className="font-mono">
                  {trainingMeta.nDistricts}
                  {t("estimator.districtCount")} ·{" "}
                  {trainingMeta.nBuildings.toLocaleString()}
                  {t("estimator.buildingCount")}
                </span>
              </div>
              <p className="pt-1 text-zinc-300">{t("estimator.dataDisclaimer")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
