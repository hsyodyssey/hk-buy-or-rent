/**
 * Train a neural network price model using ALL clean transaction data.
 *
 * Data sources:
 *   - centanet_sale_clean.csv  (~196K sale records)
 *   - centanet_rent_clean.csv  (~82K rent records)
 *
 * Model: MLP with district embedding for sale price prediction.
 * Rent: computed from actual rent data statistics (per-building, per-district).
 *
 * Usage:  npx tsx scripts/train-model.ts
 */

import * as fs from "fs";
import * as path from "path";

// ── Paths ──────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "..", "private_data");
const SALE_CSV = path.join(DATA_DIR, "centanet_sale_clean.csv");
const RENT_CSV = path.join(DATA_DIR, "centanet_rent_clean.csv");
const OUTPUT_PATH = path.join(__dirname, "..", "src", "lib", "modelWeights.ts");

// ── Types ──────────────────────────────────────────────────────

interface RawRecord {
  date: string;
  district: string;
  txType: string;
  propertyType: string;
  building: string;
  block: string;
  floor: string;
  floorZone: string;
  unit: string;
  rooms: string;
  price: number;
  areaSqft: number;
  unitPrice: number;
}

interface CleanRecord {
  district: string;
  building: string;
  floorLevel: number; // 0=low, 1=mid, 2=high
  rooms: number;
  saleableArea: number;
  logPricePerSft: number;
  pricePerSft: number;
  price: number;
}

interface RentStat {
  avgRentPerSft: number;
  count: number;
}

interface BuildingStat {
  name: string;
  avgSalePerSft: number;
  avgRentPerSft: number;
  saleCount: number;
  rentCount: number;
}

interface DistrictData {
  code: string;
  buildings: BuildingStat[];
}

// ── CSV Parsing ────────────────────────────────────────────────

function parseCSV(filePath: string): RawRecord[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  // Handle UTF-8 BOM
  const text = raw.replace(/^\uFEFF/, "");
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const colIdx: Record<string, number> = {};
  headers.forEach((h, i) => (colIdx[h] = i));

  const records: RawRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV split (doesn't handle quoted commas — our data doesn't have them)
    const parts = line.split(",");
    const get = (col: string): string => {
      const idx = colIdx[col];
      return idx !== undefined ? (parts[idx] || "").trim() : "";
    };

    const price = parseFloat(get("price"));
    const area = parseFloat(get("area_sqft"));
    const unitPrice = parseFloat(get("unit_price"));

    records.push({
      date: get("date"),
      district: get("district"),
      txType: get("tx_type"),
      propertyType: get("property_type"),
      building: get("building"),
      block: get("block"),
      floor: get("floor"),
      floorZone: get("floor_zone"),
      unit: get("unit"),
      rooms: get("rooms"),
      price: isNaN(price) ? 0 : price,
      areaSqft: isNaN(area) ? 0 : area,
      unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
    });
  }
  return records;
}

// ── Data Cleaning ──────────────────────────────────────────────

function parseFloorLevel(floor: string, floorZone: string): number {
  // Priority: floorZone first, then floor number
  if (floorZone) {
    if (/地下|低層/.test(floorZone)) return 0;
    if (/中層/.test(floorZone)) return 1;
    if (/高層/.test(floorZone)) return 2;
  }
  if (floor) {
    // Parse first number from floor (handle ranges like "37-38")
    const m = floor.match(/(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n <= 5) return 0;
      if (n <= 20) return 1;
      return 2;
    }
  }
  return 1; // default mid
}

function parseRooms(val: string): number {
  if (!val || val.trim() === "") return 2; // default 2 rooms
  const t = val.trim();
  if (t === "开放式" || t === "0") return 0;
  const n = parseFloat(t);
  if (!isNaN(n)) return Math.max(0, Math.min(5, n));
  return 2;
}

function isParking(rec: RawRecord): boolean {
  return (
    rec.propertyType === "parking" ||
    /車位|车位/.test(rec.building || "")
  );
}

function cleanSaleData(raw: RawRecord[]): CleanRecord[] {
  const result: CleanRecord[] = [];
  for (const r of raw) {
    // Skip parking, non-residential, no building
    if (isParking(r)) continue;
    if (r.propertyType !== "residential") continue;
    if (!r.building) continue;
    if (!r.district) continue;

    // Validate price and area
    if (r.price <= 0 || r.areaSqft <= 0) continue;
    if (r.price < 500_000) continue; // skip suspiciously low "sales"

    // Compute unit price
    const pricePerSft = r.unitPrice > 0 ? r.unitPrice : r.price / r.areaSqft;
    if (pricePerSft <= 0) continue;

    result.push({
      district: r.district,
      building: r.building,
      floorLevel: parseFloorLevel(r.floor, r.floorZone),
      rooms: parseRooms(r.rooms),
      saleableArea: r.areaSqft,
      logPricePerSft: Math.log(pricePerSft),
      pricePerSft,
      price: r.price,
    });
  }
  return result;
}

// ── Build Vocabulary ───────────────────────────────────────────

function buildDistrictVocab(data: CleanRecord[]): string[] {
  const districts = new Set(data.map((d) => d.district));
  return Array.from(districts).sort();
}

// ── Compute Rent Statistics ────────────────────────────────────

function computeRentStats(rentRaw: RawRecord[]): {
  buildingRent: Map<string, RentStat>;
  districtRent: Map<string, RentStat>;
} {
  const buildingRent = new Map<string, { sum: number; count: number }>();
  const districtRent = new Map<string, { sum: number; count: number }>();

  for (const r of rentRaw) {
    if (isParking(r)) continue;
    if (!r.building || !r.district) continue;
    if (r.areaSqft <= 0 || r.price <= 0) continue;

    const rentPerSft = r.price / r.areaSqft; // monthly rent per sqft

    // Building-level
    const bKey = `${r.building}||${r.district}`;
    const bExisting = buildingRent.get(bKey) || { sum: 0, count: 0 };
    bExisting.sum += rentPerSft;
    bExisting.count += 1;
    buildingRent.set(bKey, bExisting);

    // District-level
    const dExisting = districtRent.get(r.district) || { sum: 0, count: 0 };
    dExisting.sum += rentPerSft;
    dExisting.count += 1;
    districtRent.set(r.district, dExisting);
  }

  const toRentStat = (m: Map<string, { sum: number; count: number }>) => {
    const result = new Map<string, RentStat>();
    for (const [k, v] of m) {
      result.set(k, { avgRentPerSft: v.sum / v.count, count: v.count });
    }
    return result;
  };

  return {
    buildingRent: toRentStat(buildingRent),
    districtRent: toRentStat(districtRent),
  };
}

// ── Compute Building Statistics ────────────────────────────────

function computeBuildingStats(
  saleData: CleanRecord[],
  rentStats: Map<string, RentStat>,
  districtRentStats: Map<string, RentStat>,
  districtVocab: string[]
): DistrictData[] {
  // Group buildings by district
  const districtBuildings = new Map<
    string,
    Map<string, { saleSum: number; saleCount: number }>
  >();

  for (const d of saleData) {
    if (!districtBuildings.has(d.district)) {
      districtBuildings.set(d.district, new Map());
    }
    const bMap = districtBuildings.get(d.district)!;
    const existing = bMap.get(d.building) || { saleSum: 0, saleCount: 0 };
    existing.saleSum += d.pricePerSft;
    existing.saleCount += 1;
    bMap.set(d.building, existing);
  }

  // Build output, only districts that appear in vocab
  const districtSet = new Set(districtVocab);
  const result: DistrictData[] = [];

  for (const code of districtVocab) {
    const bMap = districtBuildings.get(code) || new Map();
    const buildings: BuildingStat[] = [];

    for (const [name, stats] of bMap) {
      const bKey = `${name}||${code}`;
      const rentStat = rentStats.get(bKey);
      const dRentStat = districtRentStats.get(code);

      buildings.push({
        name,
        avgSalePerSft: Math.round(stats.saleSum / stats.saleCount),
        avgRentPerSft: rentStat
          ? Math.round(rentStat.avgRentPerSft * 10) / 10
          : dRentStat
            ? Math.round(dRentStat.avgRentPerSft * 10) / 10
            : 0,
        saleCount: stats.saleCount,
        rentCount: rentStat?.count || 0,
      });
    }

      const filtered = buildings.filter((b) => b.saleCount >= 5);
    filtered.sort((a, b) => b.saleCount - a.saleCount);

    result.push({ code, buildings: filtered });
  }

  return result;
}

// ── Neural Network Training ────────────────────────────────────

type Matrix = number[][];
type Vec = number[];

function randMat(rows: number, cols: number, scale: number): Matrix {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
  );
}
function zeroVec(size: number): Vec {
  return new Array(size).fill(0);
}

function leakyRelu(x: number): number {
  return x > 0 ? x : 0.01 * x;
}
function leakyReluD(x: number): number {
  return x > 0 ? 1 : 0.01;
}

function trainSaleModel(
  data: CleanRecord[],
  districtVocab: string[],
  opts: { epochs?: number; lr?: number } = {}
) {
  const { epochs = 80, lr = 0.0005 } = opts;
  const districtIdx: Record<string, number> = {};
  districtVocab.forEach((d, i) => (districtIdx[d] = i));

  const nDistricts = districtVocab.length;
  const embedDim = 16;
  const hidden1 = 64;
  const hidden2 = 32;
  const contDim = 3; // log(area), floorLevel/2, rooms/4
  const totalInput = contDim + embedDim;

  // Init weights
  const s1 = Math.sqrt(2 / totalInput);
  const s2 = Math.sqrt(2 / hidden1);
  const s3 = Math.sqrt(2 / hidden2);

  const embedding: Matrix = Array.from({ length: nDistricts }, () =>
    Array.from({ length: embedDim }, () => (Math.random() * 2 - 1) * 0.1)
  );
  let w1 = randMat(totalInput, hidden1, s1);
  let b1 = zeroVec(hidden1);
  let w2 = randMat(hidden1, hidden2, s2);
  let b2 = zeroVec(hidden2);
  let w3 = randMat(hidden2, 1, s3);
  let b3 = [0];

  // Compute normalization params
  const normMean = new Array(contDim).fill(0);
  const normStd = new Array(contDim).fill(0);

  for (const d of data) {
    normMean[0] += Math.log(d.saleableArea);
    normMean[1] += d.floorLevel / 2;
    normMean[2] += d.rooms / 4;
  }
  for (let i = 0; i < contDim; i++) normMean[i] /= data.length;
  for (const d of data) {
    normStd[0] += (Math.log(d.saleableArea) - normMean[0]) ** 2;
    normStd[1] += (d.floorLevel / 2 - normMean[1]) ** 2;
    normStd[2] += (d.rooms / 4 - normMean[2]) ** 2;
  }
  for (let i = 0; i < contDim; i++) {
    normStd[i] = Math.sqrt(normStd[i] / data.length);
    if (normStd[i] < 1e-10) normStd[i] = 1;
  }

  function makeInput(d: CleanRecord): Vec {
    const cont = [
      (Math.log(d.saleableArea) - normMean[0]) / normStd[0],
      (d.floorLevel / 2 - normMean[1]) / normStd[1],
      (d.rooms / 4 - normMean[2]) / normStd[2],
    ];
    const dIdx = districtIdx[d.district] ?? 0;
    return [...cont, ...embedding[dIdx]];
  }

  function forward(input: Vec) {
    const z1 = b1.map((bj, j) => bj + input.reduce((s, xi, i) => s + xi * (w1[i]?.[j] ?? 0), 0));
    const a1 = z1.map(leakyRelu);
    const z2 = b2.map((bj, j) => bj + a1.reduce((s, ai, i) => s + ai * (w2[i]?.[j] ?? 0), 0));
    const a2 = z2.map(leakyRelu);
    const z3 = b3[0] + a2.reduce((s, ai, i) => s + ai * (w3[i]?.[0] ?? 0), 0);
    return { z1, a1, z2, a2, z3, input };
  }

  // Mini-batch training
  const batchSize = 64;
  const nBatches = Math.ceil(data.length / batchSize);

  console.log(`\nTraining sale model: ${data.length} samples, ${epochs} epochs, batch=${batchSize}`);
  console.log(`Architecture: ${contDim} cont + ${embedDim} embed = ${totalInput} → ${hidden1} → ${hidden2} → 1`);

  for (let epoch = 0; epoch < epochs; epoch++) {
    let totalLoss = 0;
    // Shuffle data indices
    const order = data.map((_, i) => i).sort(() => Math.random() - 0.5);

    // Accumulate gradients in batches
    const gw1 = w1.map((row) => row.map(() => 0));
    const gb1 = b1.map(() => 0);
    const gw2 = w2.map((row) => row.map(() => 0));
    const gb2 = b2.map(() => 0);
    const gw3 = w3.map((row) => row.map(() => 0));
    const gb3 = [0];
    const gEmbed = embedding.map((row) => row.map(() => 0));

    let batchCount = 0;

    for (let idx = 0; idx < order.length; idx++) {
      const d = data[order[idx]];
      const dIdx = districtIdx[d.district] ?? 0;
      const input = makeInput(d);
      const { z1, a1, z2, a2, z3 } = forward(input);

      const pred = z3;
      const err = pred - d.logPricePerSft;
      totalLoss += err * err;

      // Backprop
      const dz3 = 2 * err;
      for (let i = 0; i < a2.length; i++) gw3[i][0] += dz3 * a2[i];
      gb3[0] += dz3;

      const da2 = a2.map((_, i) => dz3 * (w3[i]?.[0] ?? 0));
      const dz2 = da2.map((val, i) => val * leakyReluD(z2[i]));
      for (let j = 0; j < dz2.length; j++) {
        for (let i = 0; i < a1.length; i++) gw2[i][j] += dz2[j] * a1[i];
        gb2[j] += dz2[j];
      }

      const da1 = a1.map((_, i) => dz2.reduce((s, dz, j) => s + dz * (w2[i]?.[j] ?? 0), 0));
      const dz1 = da1.map((val, i) => val * leakyReluD(z1[i]));
      for (let j = 0; j < dz1.length; j++) {
        for (let i = 0; i < input.length; i++) gw1[i][j] += dz1[j] * input[i];
        gb1[j] += dz1[j];
      }

      const dInput = input.map((_, i) => dz1.reduce((s, dz, j) => s + dz * (w1[i]?.[j] ?? 0), 0));
      for (let dd = 0; dd < embedDim; dd++) {
        gEmbed[dIdx][dd] += dInput[contDim + dd] ?? 0;
      }

      batchCount++;

      // Apply batch
      if (batchCount === batchSize || idx === order.length - 1) {
        const scale = lr / batchCount;
        for (let i = 0; i < w1.length; i++)
          for (let j = 0; j < w1[i].length; j++) w1[i][j] -= scale * gw1[i][j];
        for (let j = 0; j < b1.length; j++) b1[j] -= scale * gb1[j];
        for (let i = 0; i < w2.length; i++)
          for (let j = 0; j < w2[i].length; j++) w2[i][j] -= scale * gw2[i][j];
        for (let j = 0; j < b2.length; j++) b2[j] -= scale * gb2[j];
        for (let i = 0; i < w3.length; i++)
          for (let j = 0; j < w3[i].length; j++) w3[i][j] -= scale * gw3[i][j];
        b3[0] -= scale * gb3[0];
        for (let di = 0; di < nDistricts; di++)
          for (let dd = 0; dd < embedDim; dd++)
            embedding[di][dd] -= scale * gEmbed[di][dd];

        // Reset accumulators
        for (let i = 0; i < gw1.length; i++) gw1[i].fill(0);
        gb1.fill(0);
        for (let i = 0; i < gw2.length; i++) gw2[i].fill(0);
        gb2.fill(0);
        for (let i = 0; i < gw3.length; i++) gw3[i].fill(0);
        gb3[0] = 0;
        for (let di = 0; di < nDistricts; di++) gEmbed[di].fill(0);
        batchCount = 0;
      }
    }

    if (epoch % 10 === 0 || epoch === epochs - 1) {
      console.log(`Epoch ${epoch}/${epochs} | MSE: ${(totalLoss / data.length).toFixed(6)}`);
    }
  }

  // Compute RMSE
  let rmse = 0;
  for (const d of data) {
    const input = makeInput(d);
    const { z3 } = forward(input);
    const predPerSft = Math.exp(z3);
    rmse += (predPerSft - d.pricePerSft) ** 2;
  }
  rmse = Math.sqrt(rmse / data.length);
  console.log(`\nFinal RMSE (sale per sqft): HK$${rmse.toFixed(0)}`);

  return {
    embedding,
    w1,
    b1,
    w2,
    b2,
    w3,
    b3,
    normMean,
    normStd,
    rmse,
    nDistricts,
    embedDim,
    hidden1,
    hidden2,
  };
}

// ── Main ───────────────────────────────────────────────────────

function main() {
  console.log("=== HK Property Neural Network Model Training ===\n");

  // 1. Read data
  console.log("Reading sale data...");
  const saleRaw = parseCSV(SALE_CSV);
  console.log(`  Parsed ${saleRaw.length} raw sale records`);

  console.log("Reading rent data...");
  const rentRaw = parseCSV(RENT_CSV);
  console.log(`  Parsed ${rentRaw.length} raw rent records`);

  // 2. Clean sale data
  const saleData = cleanSaleData(saleRaw);
  console.log(`\nCleaned sale data: ${saleData.length} training samples`);

  // 3. Build district vocabulary
  const districtVocab = buildDistrictVocab(saleData);
  console.log(`Districts with sale data: ${districtVocab.length}`);

  // Count unique buildings
  const uniqueBuildings = new Set(saleData.map((d) => `${d.building}||${d.district}`));
  console.log(`Unique building-district combos: ${uniqueBuildings.size}`);

  // 4. Train sale model
  const model = trainSaleModel(saleData, districtVocab);

  // 5. Compute rent statistics
  console.log("\nComputing rent statistics...");
  const { buildingRent, districtRent } = computeRentStats(rentRaw);
  console.log(`  Buildings with rent data: ${buildingRent.size}`);
  console.log(`  Districts with rent data: ${districtRent.size}`);

  // 6. Build per-district building metadata
  const districtData = computeBuildingStats(saleData, buildingRent, districtRent, districtVocab);

  // 7. Generate TypeScript output
  const totalBuildings = districtData.reduce((s, d) => s + d.buildings.length, 0);
  console.log(`\nTotal districts: ${districtData.length}`);
  console.log(`Total buildings with stats: ${totalBuildings}`);

  // Round model weights for smaller file size
  function roundVec(v: Vec, dp = 6): Vec {
    return v.map((x) => parseFloat(x.toFixed(dp)));
  }
  function roundMat(m: Matrix, dp = 6): Matrix {
    return m.map((row) => roundVec(row, dp));
  }

  const weightsTs = `// Auto-generated by scripts/train-model.ts — DO NOT EDIT
// Trained on ${saleData.length.toLocaleString()} sale records + ${rentRaw.length.toLocaleString()} rent records
// ${districtVocab.length} districts, ${totalBuildings} buildings

export const SALE_MODEL = ${JSON.stringify(
    {
      embedding: roundMat(model.embedding),
      w1: roundMat(model.w1),
      b1: roundVec(model.b1),
      w2: roundMat(model.w2),
      b2: roundVec(model.b2),
      w3: roundMat(model.w3),
      b3: roundVec(model.b3),
      normMean: roundVec(model.normMean),
      normStd: roundVec(model.normStd),
      rmse: parseFloat(model.rmse.toFixed(0)),
      nDistricts: model.nDistricts,
      embedDim: model.embedDim,
      hidden1: model.hidden1,
      hidden2: model.hidden2,
    },
    null,
    2
  )} as const;

export const DISTRICTS: { code: string; buildings: { name: string; avgSalePerSft: number; avgRentPerSft: number; saleCount: number; rentCount: number }[] }[] = ${JSON.stringify(districtData, null, 2)};

export const FLOOR_LEVELS = ["low", "mid", "high"] as const;

export const ROOM_OPTIONS = [
  { value: 0, label: { en: "Studio", zh: "开放式", tc: "開放式" } },
  { value: 1, label: { en: "1-room", zh: "1房", tc: "1房" } },
  { value: 2, label: { en: "2-room", zh: "2房", tc: "2房" } },
  { value: 3, label: { en: "3-room", zh: "3房", tc: "3房" } },
  { value: 4, label: { en: "4-room", zh: "4房", tc: "4房" } },
] as const;

export const TRAINING_META = {
  saleSamples: ${saleData.length},
  rentSamples: ${rentRaw.length},
  nDistricts: ${districtVocab.length},
  nBuildings: ${totalBuildings},
  saleRmse: ${Math.round(model.rmse)},
} as const;
`;

  fs.writeFileSync(OUTPUT_PATH, weightsTs, "utf-8");
  console.log(`\n[OK] Weights written to ${OUTPUT_PATH}`);
  console.log(`Model RMSE: HK$${model.rmse.toFixed(0)}/sqft`);
  console.log(`\nDone.`);
}

main();
