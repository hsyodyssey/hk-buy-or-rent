/**
 * Fetch mapinfo API from Centanet to extract estate data (buildingAge, typeCode, gMap, etc.)
 *
 * Usage: npx tsx scripts/fetch-mapinfo.ts
 *
 * API: GET https://hk.centanet.com/findproperty/api/Hma/mapinfo?hmaId={HMA_ID}
 *
 * Steps:
 *   1. Read HMA IDs from private_data/hma.json (regex: HMA\d+)
 *   2. For each HMA ID, fetch estate data from the mapinfo API
 *   3. Save raw JSON to private_data/mapinfo/{HMA_ID}.json
 *   4. Extract estate-level data into a flat CSV
 *   5. Support resume (skip already-fetched HMAs)
 */

import * as fs from "fs";
import * as path from "path";
import https from "https";

// ── Paths ──────────────────────────────────────────────────────

const HMA_JSON = path.join(__dirname, "..", "private_data", "hma.json");
const MAPINFO_DIR = path.join(__dirname, "..", "private_data", "mapinfo");
const OUTPUT_CSV = path.join(
  __dirname,
  "..",
  "private_data",
  "centanet_estate_data.csv"
);

const API_BASE =
  "https://hk.centanet.com/findproperty/api/Hma/mapinfo?hmaId=";
const DELAY_MS = 800; // delay between requests to avoid rate limiting

// ── Helpers ────────────────────────────────────────────────────

function extractHmaIds(): string[] {
  const text = fs.readFileSync(HMA_JSON, "utf-8");
  const matches = text.match(/HMA\d+/g);
  if (!matches) return [];
  return [...new Set(matches)].sort();
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
          Referer: "https://hk.centanet.com/findproperty/list/buy",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error for ${url}: ${data.substring(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Timeout for ${url}`));
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Estate CSV row extraction ──────────────────────────────────

interface EstateRow {
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
}

function extractEstates(
  hmaId: string,
  apiData: any
): EstateRow[] {
  const estates = apiData?.estateResult?.data;
  if (!Array.isArray(estates)) return [];

  return estates.map((e: any) => ({
    hmaId,
    hmaName: e.scope?.hma || "",
    estateNameHK: e.estateNameHK || "",
    estateNameEN: e.estateNameEN || "",
    typeCode: e.typeCode || "",
    minBuildingAge: e.minBuildingAge ?? 0,
    maxBuildingAge: e.maxBuildingAge ?? 0,
    lat: e.gMap?.lat ?? 0,
    lng: e.gMap?.lng ?? 0,
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
  }));
}

function escapeCsv(val: any): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("=== Fetch Centanet Mapinfo Estate Data ===\n");

  // 1. Get HMA IDs
  const hmaIds = extractHmaIds();
  console.log(`Found ${hmaIds.length} unique HMA IDs\n`);

  // 2. Ensure output dirs
  fs.mkdirSync(MAPINFO_DIR, { recursive: true });

  // 3. Check which HMAs are already fetched (resume support)
  const existingFiles = fs.readdirSync(MAPINFO_DIR);
  const fetchedHmas = new Set(
    existingFiles
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""))
  );

  const toFetch = hmaIds.filter((id) => !fetchedHmas.has(id));
  console.log(
    `Already fetched: ${fetchedHmas.size} | To fetch: ${toFetch.length}\n`
  );

  // 4. Fetch each HMA
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toFetch.length; i++) {
    const hmaId = toFetch[i];
    const url = API_BASE + hmaId;

    process.stdout.write(
      `[${i + 1}/${toFetch.length}] Fetching ${hmaId}... `
    );

    try {
      const data = await fetchJson(url);
      const outPath = path.join(MAPINFO_DIR, `${hmaId}.json`);
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");

      const estateCount = data?.estateResult?.data?.length ?? 0;
      console.log(`OK (${estateCount} estates)`);
      successCount++;
    } catch (err: any) {
      console.log(`FAILED: ${err.message}`);
      failCount++;
      // Write empty file to mark as attempted (avoid re-fetching)
      fs.writeFileSync(
        path.join(MAPINFO_DIR, `${hmaId}.json`),
        JSON.stringify({ error: err.message }, null, 2),
        "utf-8"
      );
    }

    // Rate limiting
    if (i < toFetch.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(
    `\nFetch complete: ${successCount} success, ${failCount} failed`
  );

  // 5. Parse all saved JSONs and build CSV
  console.log("\nExtracting estate data to CSV...");

  const allEstates: EstateRow[] = [];
  const allFiles = fs.readdirSync(MAPINFO_DIR).filter((f) => f.endsWith(".json"));

  for (const file of allFiles) {
    try {
      const raw = fs.readFileSync(path.join(MAPINFO_DIR, file), "utf-8");
      const data = JSON.parse(raw);
      if (data.error) continue; // skip failed fetches
      const hmaId = file.replace(".json", "");
      const rows = extractEstates(hmaId, data);
      allEstates.push(...rows);
    } catch {
      // skip malformed files
    }
  }

  console.log(`Extracted ${allEstates.length} estates total`);

  // 6. Write CSV
  const headers = Object.keys(allEstates[0] || {}) as (keyof EstateRow)[];
  const csvLines = [
    headers.join(","),
    ...allEstates.map((row) => headers.map((h) => escapeCsv(row[h])).join(",")),
  ];

  fs.writeFileSync(OUTPUT_CSV, csvLines.join("\n"), "utf-8");
  console.log(`CSV written to ${OUTPUT_CSV}`);
  console.log(`Total estates: ${allEstates.length}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
