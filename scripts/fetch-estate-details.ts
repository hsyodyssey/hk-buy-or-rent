/**
 * Fetch developer and management company data from Centanet estate detail pages.
 *
 * The mapinfo API doesn't include developer/managementCompany for existing estates,
 * but these fields are embedded in the estate detail page HTML (SSR-rendered JS).
 *
 * Strategy:
 *   1. Read centanet_estate_mtr.csv for typeCode list
 *   2. Also scan mapinfo JSONs for typeCode → estateNameHK mapping
 *   3. For each typeCode, fetch the estate detail page
 *   4. Extract developer and managementCompany from the page's inline JS
 *   5. Save to centanet_estate_developers.csv
 *
 * Usage:  npx tsx scripts/fetch-estate-details.ts
 */

import * as fs from "fs";
import * as path from "path";
import https from "https";

// ── Paths ──────────────────────────────────────────────────────

const PRIVATE_DIR = path.join(__dirname, "..", "private_data");
const ESTATE_CSV = path.join(PRIVATE_DIR, "centanet_estate_mtr.csv");
const MAPINFO_DIR = path.join(PRIVATE_DIR, "mapinfo");
const OUTPUT_CSV = path.join(PRIVATE_DIR, "centanet_estate_developers.csv");
const PROGRESS_FILE = path.join(PRIVATE_DIR, "estate_details_progress.json");

const BASE_URL = "https://hk.centanet.com/estate/";
const DELAY_MS = 600;
const CONCURRENT = 3;
const MAX_RETRIES = 2;

// ── Types ──────────────────────────────────────────────────────

interface EstateInfo {
  typeCode: string;
  estateNameHK: string;
  estateNameEN: string;
}

interface EstateDetail {
  typeCode: string;
  estateNameHK: string;
  developer: string;
  managementCompany: string;
}

interface Progress {
  completed: string[]; // typeCodes already fetched
  failed: string[];
}

// ── Helpers ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
          Referer: "https://hk.centanet.com/findproperty/list/buy",
        },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchPage(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error(`Timeout for ${url}`));
    });
  });
}

function extractFromPage(html: string): {
  developer: string;
  managementCompany: string;
} {
  // The page embeds these in inline JS like:
  //   developer:"萬泰\u002F信置\u002F嘉里建設"
  //   managementCompany:"嘉里物業管理服務有限公司"

  let developer = "";
  let managementCompany = "";

  const devMatch = html.match(/developer:"([^"]*?)"/);
  if (devMatch) {
    developer = devMatch[1];
    // Decode \uXXXX escapes
    developer = developer.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    // Decode \u002F → /
    developer = developer.replace(/\\u002F/g, "/");
  }

  const mgmtMatch = html.match(/managementCompany:"([^"]*?)"/);
  if (mgmtMatch) {
    managementCompany = mgmtMatch[1];
    managementCompany = managementCompany.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
  }

  return { developer, managementCompany };
}

function escapeCsv(val: string): string {
  const s = String(val || "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── Build estate list from mapinfo JSONs ────────────────────────

function buildEstateList(): EstateInfo[] {
  const estateMap = new Map<string, EstateInfo>();

  if (!fs.existsSync(MAPINFO_DIR)) {
    console.log("No mapinfo directory found, using CSV only");
    return [];
  }

  const files = fs.readdirSync(MAPINFO_DIR).filter((f) => f.endsWith(".json"));
  console.log(`Scanning ${files.length} mapinfo JSONs...`);

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(MAPINFO_DIR, file), "utf8");
      const data = JSON.parse(raw);
      if (data.error) continue;

      const estates = data?.estateResult?.data || [];
      for (const e of estates) {
        if (e.typeCode && !estateMap.has(e.typeCode)) {
          estateMap.set(e.typeCode, {
            typeCode: e.typeCode,
            estateNameHK: e.estateNameHK || "",
            estateNameEN: e.estateNameEN || "",
          });
        }
      }
    } catch {
      // skip
    }
  }

  console.log(`Found ${estateMap.size} unique estates from mapinfo`);
  return Array.from(estateMap.values());
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("=== Fetch Estate Developer & Management Data ===\n");

  // 1. Build estate list
  const estates = buildEstateList();
  if (estates.length === 0) {
    console.error("No estates found. Run fetch-mapinfo.ts first.");
    process.exit(1);
  }

  // 2. Load progress (resume support)
  let progress: Progress = { completed: [], failed: [] };
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
    } catch {
      // start fresh
    }
  }

  const completedSet = new Set(progress.completed);
  const toFetch = estates.filter((e) => !completedSet.has(e.typeCode));

  console.log(
    `Already completed: ${completedSet.size} | To fetch: ${toFetch.length}\n`
  );

  if (toFetch.length === 0) {
    console.log("All estates already fetched!");
  }

  // 3. Fetch with concurrency control
  const results: EstateDetail[] = [];

  // Load existing results
  if (fs.existsSync(OUTPUT_CSV)) {
    const existing = fs.readFileSync(OUTPUT_CSV, "utf8");
    const lines = existing.trim().split("\n").slice(1); // skip header
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length >= 4) {
        results.push({
          typeCode: parts[0],
          estateNameHK: parts[1],
          developer: parts[2],
          managementCompany: parts.slice(3).join(","), // handle commas in company names
        });
      }
    }
  }

  const batchSize = CONCURRENT;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);

    const promises = batch.map(async (estate) => {
      const encodedName = encodeURIComponent(estate.estateNameHK);
      const url = `${BASE_URL}${encodedName}/${estate.typeCode}`;

      for (let retry = 0; retry <= MAX_RETRIES; retry++) {
        try {
          const html = await fetchPage(url);
          const { developer, managementCompany } = extractFromPage(html);

          if (!developer && !managementCompany && html.length < 5000) {
            // Probably an error page
            throw new Error("Empty page");
          }

          return {
            typeCode: estate.typeCode,
            estateNameHK: estate.estateNameHK,
            developer,
            managementCompany,
          } as EstateDetail;
        } catch (err: any) {
          if (retry === MAX_RETRIES) {
            return {
              typeCode: estate.typeCode,
              estateNameHK: estate.estateNameHK,
              developer: "",
              managementCompany: "",
              failed: true,
            } as EstateDetail & { failed?: boolean };
          }
          await sleep(1000 * (retry + 1));
        }
      }
      return null!;
    });

    const batchResults = await Promise.all(promises);

    for (const r of batchResults) {
      if (!r) continue;
      if ((r as any).failed) {
        progress.failed.push(r.typeCode);
        failCount++;
        console.log(`  FAILED: ${r.estateNameHK} (${r.typeCode})`);
      } else {
        successCount++;
        results.push(r);
      }
      progress.completed.push(r.typeCode);
    }

    // Save progress
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf8");

    // Save intermediate CSV
    writeCsv(results);

    const pct = (
      ((i + batchSize) / toFetch.length) *
      100
    ).toFixed(1);
    process.stdout.write(
      `\r[${pct}%] Fetched ${successCount + failCount}/${toFetch.length} (OK: ${successCount}, Failed: ${failCount})`
    );

    if (i + batchSize < toFetch.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(
    `\n\nFetch complete: ${successCount} success, ${failCount} failed`
  );

  // 4. Final CSV write
  writeCsv(results);

  // Stats
  const withDeveloper = results.filter((r) => r.developer).length;
  const withManagement = results.filter((r) => r.managementCompany).length;
  console.log(`\nResults:`);
  console.log(`  Total estates: ${results.length}`);
  console.log(`  With developer: ${withDeveloper}`);
  console.log(`  With management: ${withManagement}`);
  console.log(`  Failed: ${progress.failed.length}`);
  console.log(`\nOutput: ${OUTPUT_CSV}`);
}

function writeCsv(results: EstateDetail[]) {
  const header = "typeCode,estateNameHK,developer,managementCompany";
  const lines = results.map(
    (r) =>
      `${escapeCsv(r.typeCode)},${escapeCsv(r.estateNameHK)},${escapeCsv(r.developer)},${escapeCsv(r.managementCompany)}`
  );
  fs.writeFileSync(OUTPUT_CSV, [header, ...lines].join("\n"), "utf8");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
