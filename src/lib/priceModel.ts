/**
 * Price estimation using ONNX Runtime (XGBoost model).
 *
 * Architecture:
 *   - districtCodes.ts   → static district code list (sync import)
 *   - model_meta.json    → district/building stats + target encodings (async)
 *   - model.onnx         → XGBoost ONNX model (loaded main-thread)
 *   - Features: [log_area, floor_level, rooms, district_enc, building_enc]
 *   - Target: log(price_per_sqft)
 *
 * onnxruntime-web is loaded lazily (client-only) to avoid SSR issues.
 */

import { DISTRICT_CODES } from "./districtCodes";

import type { InferenceSession, Tensor as OrtTensor } from "onnxruntime-web";

// ─── Types ──────────────────────────────────────────────────────

export interface PriceEstimateInput {
  districtIdx: number;
  floorLevel: number; // 0=low, 1=mid, 2=high
  saleableArea: number; // in sq ft
  rooms: number; // 0=studio, 1-4
  buildingAge: number; // years
  walkToMtrMin: number; // walking minutes
  walkToMallMin: number; // walking minutes
}

export interface PriceEstimateResult {
  estimatedPrice: number;
  estimatedPricePerSft: number;
  priceRange: [number, number];
  estimatedMonthlyRent: number;
  districtCode: string;
  buildingName?: string;
  floorLevel: string;
  saleableArea: number;
  rooms: number;
  modelRmse: number;
  avgRentPerSft: number;
  rentalYield: number;
}

export interface DistrictOption {
  code: string;
  buildingCount: number;
}

export interface BuildingOption {
  name: string;
  avgSalePerSft: number;
  avgRentPerSft: number;
  saleCount: number;
  rentCount: number;
}

// ─── Static constants (never change) ────────────────────────────

export const FLOOR_LEVELS = ["low", "mid", "high"] as const;

export const ROOM_OPTIONS = [
  { value: 0, label: { en: "Studio", zh: "开放式", tc: "開放式" } },
  { value: 1, label: { en: "1-room", zh: "1房", tc: "1房" } },
  { value: 2, label: { en: "2-room", zh: "2房", tc: "2房" } },
  { value: 3, label: { en: "3-room", zh: "3房", tc: "3房" } },
  { value: 4, label: { en: "4-room", zh: "4房", tc: "4房" } },
] as const;

// ─── Metadata types ─────────────────────────────────────────────

interface BuildingStat {
  name: string;
  avgSalePerSft: number;
  avgRentPerSft: number;
  saleCount: number;
  rentCount: number;
}

interface DistrictStat {
  code: string;
  buildings: BuildingStat[];
}

interface ModelMeta {
  modelType: string;
  featureNames: string[];
  districtEncoding: Record<string, number>;
  buildingEncoding: Record<string, number>;
  districts: DistrictStat[];
  districtDefaults: Record<string, { buildingAge: number; walkToMtrMin: number; walkToMallMin: number }>;
  buildingEstateInfo: Record<string, { buildingAge: number; walkToMtrMin: number; walkToMallMin: number; nearestMtrStation: string; nearestShoppingMall: string; developer?: string; managementCompany?: string }>;
  floorLevels: string[];
  roomOptions: { value: number; label: { en: string; zh: string; tc: string } }[];
  trainingMeta: {
    saleSamples: number;
    rentSamples: number;
    nDistricts: number;
    nBuildings: number;
    saleRmse: number;
    saleMae: number;
    featureImportance: Record<string, number>;
  };
  logRmseApprox: number;
}

// ─── ONNX session (lazy-loaded, client-only) ────────────────────────

let ort: typeof import("onnxruntime-web") | null = null;
let session: InferenceSession | null = null;
let sessionLoadPromise: Promise<void> | null = null;

async function ensureOrt(): Promise<typeof import("onnxruntime-web")> {
  if (ort) return ort;
  ort = await import("onnxruntime-web");
  ort.env.wasm.wasmPaths = "/";
  ort.env.wasm.numThreads = 1;
  return ort;
}

async function ensureSession(): Promise<InferenceSession> {
  if (session) return session;
  if (!sessionLoadPromise) {
    sessionLoadPromise = (async () => {
      const ortModule = await ensureOrt();
      session = await ortModule.InferenceSession.create("/model.onnx", {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
    })();
  }
  await sessionLoadPromise;
  return session!;
}

// ─── Metadata loading ───────────────────────────────────────────

let meta: ModelMeta | null = null;
let metaLoadPromise: Promise<ModelMeta> | null = null;

async function loadMeta(): Promise<ModelMeta> {
  if (meta) return meta;
  if (!metaLoadPromise) {
    metaLoadPromise = fetch("/model_meta.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load model metadata: ${r.status}`);
        return r.json() as Promise<ModelMeta>;
      })
      .then((m) => {
        meta = m;
        return m;
      });
  }
  return metaLoadPromise;
}

// ─── Preload ────────────────────────────────────────────────────

let preloaded = false;

/**
 * Pre-load metadata and ONNX model. Call when estimator tab opens.
 */
export async function preloadModel(): Promise<void> {
  if (preloaded) return;
  preloaded = true;
  await Promise.all([loadMeta(), ensureSession()]);
}

// ─── Public sync accessors (valid after preloadModel) ───────────

export function isModelReady(): boolean {
  return meta !== null && session !== null;
}

export function getDistricts(): DistrictStat[] {
  return meta?.districts ?? [];
}

export function getTrainingMeta() {
  return (
    meta?.trainingMeta ?? {
      saleSamples: 0,
      rentSamples: 0,
      nDistricts: 0,
      nBuildings: 0,
      saleRmse: 0,
      saleMae: 0,
      featureImportance: {},
    }
  );
}

export function getDistrictOptions(): DistrictOption[] {
  return (meta?.districts ?? []).map((d) => ({
    code: d.code,
    buildingCount: d.buildings.length,
  }));
}

export function getBuildingsForDistrict(districtIdx: number): BuildingOption[] {
  if (!meta || districtIdx < 0 || districtIdx >= meta.districts.length) return [];
  return meta.districts[districtIdx].buildings;
}

export function getDistrictIndex(code: string): number {
  return DISTRICT_CODES.indexOf(code);
}

export function getDistrictDefaults(districtIdx: number): { buildingAge: number; walkToMtrMin: number; walkToMallMin: number } | null {
  if (!meta || districtIdx < 0 || districtIdx >= meta.districts.length) return null;
  const district = meta.districts[districtIdx];
  return meta.districtDefaults[district.code] ?? null;
}

export function getBuildingEstateInfo(
  districtIdx: number,
  buildingName: string
): { buildingAge: number; walkToMtrMin: number; walkToMallMin: number; nearestMtrStation: string; nearestShoppingMall: string; developer: string; managementCompany: string } | null {
  if (!meta || districtIdx < 0 || districtIdx >= meta.districts.length) return null;
  const district = meta.districts[districtIdx];
  const bkey = `${buildingName}||${district.code}`;
  const info = meta.buildingEstateInfo[bkey] ?? null;
  if (!info) return null;
  return {
    buildingAge: info.buildingAge ?? 25,
    walkToMtrMin: info.walkToMtrMin ?? 20,
    walkToMallMin: info.walkToMallMin ?? 15,
    nearestMtrStation: info.nearestMtrStation ?? "",
    nearestShoppingMall: info.nearestShoppingMall ?? "",
    developer: (info as any).developer ?? "",
    managementCompany: (info as any).managementCompany ?? "",
  };
}


// ─── Inference ──────────────────────────────────────────────────

const LOG_RMSE = 0.15;

export async function estimatePrice(
  input: PriceEstimateInput,
  buildingName?: string
): Promise<PriceEstimateResult> {
  const [m, sess] = await Promise.all([loadMeta(), ensureSession()]);
  const ortModule = await ensureOrt();

  const district = m.districts[input.districtIdx];
  const selectedBuilding =
    buildingName && district
      ? district.buildings.find((b) => b.name === buildingName)
      : undefined;

  const districtCode = district?.code ?? "";
  const districtEnc =
    m.districtEncoding[districtCode] ??
    m.districtEncoding["__mean__"] ??
    9.42;

  const buildingKey =
    buildingName && districtCode ? `${buildingName}||${districtCode}` : "";
  const buildingEnc = buildingKey
    ? m.buildingEncoding[buildingKey] ?? districtEnc
    : districtEnc;

  const features = [
    Math.log(Math.max(input.saleableArea, 1)),
    input.floorLevel,
    input.rooms,
    districtEnc,
    buildingEnc,
    input.buildingAge,
    input.walkToMtrMin,
    input.walkToMallMin,
  ];

  const inputTensor = new ortModule.Tensor(
    "float32",
    new Float32Array(features),
    [1, features.length]
  );

  const inputName = sess.inputNames[0];
  const results = await sess.run({ [inputName]: inputTensor });

  const outputName = sess.outputNames[0];
  const output = results[outputName];
  const logPricePerSft = output.data[0] as number;

  const modelPricePerSft = Math.exp(logPricePerSft);
  const fallbackPricePerSft = getFallbackSalePerSft(district, selectedBuilding);
  const usedSaleFallback =
    (modelPricePerSft < 1000 || modelPricePerSft > 100000) &&
    fallbackPricePerSft > 0;
  const pricePerSft = usedSaleFallback ? fallbackPricePerSft : modelPricePerSft;
  const estimatedPrice = pricePerSft * input.saleableArea;
  const resolvedLogP = Math.log(Math.max(pricePerSft, 1));
  const logLow = resolvedLogP - 1.96 * LOG_RMSE;
  const logHigh = resolvedLogP + 1.96 * LOG_RMSE;

  // Rent from actual data
  let avgRentPerSft = 0;
  if (district) {
    if (selectedBuilding && selectedBuilding.avgRentPerSft > 0) {
      avgRentPerSft = selectedBuilding.avgRentPerSft;
    } else {
      const withRent = district.buildings.filter((b) => b.avgRentPerSft > 0);
      if (withRent.length > 0) {
        avgRentPerSft =
          withRent.reduce((s, b) => s + b.avgRentPerSft, 0) / withRent.length;
      }
    }
  }

  const estimatedMonthlyRent =
    avgRentPerSft > 0
      ? avgRentPerSft * input.saleableArea
      : (estimatedPrice * 0.028) / 12;

  const rentalYield =
    estimatedPrice > 0 ? (estimatedMonthlyRent * 12) / estimatedPrice : 0;

  const floorLabels = ["low", "mid", "high"];

  return {
    estimatedPrice,
    estimatedPricePerSft: pricePerSft,
    priceRange: [
      Math.exp(logLow) * input.saleableArea,
      Math.exp(logHigh) * input.saleableArea,
    ],
    estimatedMonthlyRent,
    districtCode: district?.code ?? "Unknown",
    buildingName,
    floorLevel: floorLabels[input.floorLevel] ?? "mid",
    saleableArea: input.saleableArea,
    rooms: input.rooms,
    modelRmse: m.trainingMeta.saleRmse,
    avgRentPerSft,
    rentalYield,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function getFallbackSalePerSft(
  district: DistrictStat | undefined,
  selectedBuilding: BuildingStat | undefined
): number {
  if (selectedBuilding && selectedBuilding.avgSalePerSft > 0) {
    return selectedBuilding.avgSalePerSft;
  }
  if (!district || district.buildings.length === 0) return 0;

  let totalW = 0;
  let totalV = 0;
  for (const b of district.buildings) {
    if (b.avgSalePerSft <= 0 || b.saleCount <= 0) continue;
    totalW += b.saleCount;
    totalV += b.avgSalePerSft * b.saleCount;
  }
  return totalW > 0 ? totalV / totalW : 0;
}
