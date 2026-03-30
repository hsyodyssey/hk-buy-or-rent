"use client";

import { useMemo } from "react";
import { CalcResults } from "@/hooks/usePropertyCalc";
import { formatCompactHKD, formatPercent } from "@/lib/formatters";
import { calcSingleYear } from "@/lib/calculator";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  results: CalcResults;
}

interface TornadoRow {
  name: string;
  lowLabel: string;
  highLabel: string;
  lowDiff: number;
  highDiff: number;
  swing: number;
}

export default function SensitivityChart({ results }: Props) {
  const { t } = useLanguage();
  const { params } = results;

  // ── Heatmap grid ──────────────────────────────────────────────
  const riSteps = useMemo(
    () => Array.from({ length: 11 }, (_, i) => i * 0.01),
    []
  );
  const gSteps = useMemo(
    () => Array.from({ length: 11 }, (_, i) => -0.02 + i * 0.01),
    []
  );

  const grid = useMemo(() => {
    return riSteps.map((ri) =>
      gSteps.map((g) => {
        const modified = { ...params, opportunityCostRate: ri, appreciationRate: g };
        const r = calcSingleYear(modified);
        return r.difference;
      })
    );
  }, [params, riSteps, gSteps]);

  const maxAbsDiff = useMemo(() => {
    let max = 0;
    for (const row of grid) {
      for (const v of row) {
        if (Math.abs(v) > max) max = Math.abs(v);
      }
    }
    return max || 1;
  }, [grid]);

  function cellColor(diff: number): string {
    const intensity = Math.min(Math.abs(diff) / maxAbsDiff, 1);
    // Chinese convention: red = good for buyer, green = bad. diff = TCO - TCR.
    if (diff > 0) {
      // Renting cheaper than buying — bad for buyer — green tones
      const r = Math.round(180 - intensity * 80);
      const g = Math.round(220 + intensity * 25);
      const b = Math.round(200 + intensity * 20);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Buying cheaper — good for buyer — red tones
      const r = Math.round(220 + intensity * 35);
      const g = Math.round(160 - intensity * 80);
      const b = Math.round(140 - intensity * 60);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  // ── What-If impact rows ───────────────────────────────────────
  const tornadoData: TornadoRow[] = useMemo(() => {
    const tests: {
      nameKey: string;
      key: keyof typeof params;
      low: number | null;
      high: number | null;
      lowMult: number;
      highMult: number;
      fmtParam: (v: number) => string;
    }[] = [
      {
        nameKey: "sensitivity.appreciation",
        key: "appreciationRate",
        low: -0.03,
        high: 0.05,
        lowMult: 0,
        highMult: 0,
        fmtParam: (v) => formatPercent(v, 1),
      },
      {
        nameKey: "sensitivity.opportunityCost",
        key: "opportunityCostRate",
        low: 0,
        high: 0.10,
        lowMult: 0,
        highMult: 0,
        fmtParam: (v) => formatPercent(v, 1),
      },
      {
        nameKey: "sensitivity.mortgageRate",
        key: "mortgageRate",
        low: 0.02,
        high: 0.06,
        lowMult: 0,
        highMult: 0,
        fmtParam: (v) => formatPercent(v, 1),
      },
      {
        nameKey: "sensitivity.propertyPrice",
        key: "propertyPrice",
        low: null,
        high: null,
        lowMult: 0.8,
        highMult: 1.2,
        fmtParam: (v) => formatCompactHKD(v),
      },
      {
        nameKey: "sensitivity.monthlyRent",
        key: "monthlyRent",
        low: null,
        high: null,
        lowMult: 0.7,
        highMult: 1.3,
        fmtParam: (v) => formatCompactHKD(v),
      },
      {
        nameKey: "sensitivity.ltvRatio",
        key: "ltvRatio",
        low: 0.3,
        high: 0.9,
        lowMult: 0,
        highMult: 0,
        fmtParam: (v) => formatPercent(v, 0),
      },
    ];

    return tests
      .map((test) => {
        const baseVal = params[test.key] as number;
        const lowVal = test.low !== null ? test.low : baseVal * test.lowMult;
        const highVal = test.high !== null ? test.high : baseVal * test.highMult;

        const lowResult = calcSingleYear({ ...params, [test.key]: lowVal });
        const highResult = calcSingleYear({ ...params, [test.key]: highVal });

        return {
          name: t(test.nameKey as Parameters<typeof t>[0]),
          lowLabel: test.fmtParam(lowVal),
          highLabel: test.fmtParam(highVal),
          lowDiff: lowResult.difference,
          highDiff: highResult.difference,
          swing: Math.abs(highResult.difference - lowResult.difference),
        };
      })
      .sort((a, b) => b.swing - a.swing);
  }, [params, t]);

  // Scale: find global min/max across all tornado rows
  const { globalMin, globalMax } = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const row of tornadoData) {
      min = Math.min(min, row.lowDiff, row.highDiff);
      max = Math.max(max, row.lowDiff, row.highDiff);
    }
    const pad = (max - min) * 0.05;
    return { globalMin: min - pad, globalMax: max + pad };
  }, [tornadoData]);

  const toPos = (v: number) =>
    ((v - globalMin) / (globalMax - globalMin)) * 100;
  const zeroPos = toPos(0);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-800">
        {t("sensitivity.title")}
      </h2>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Heatmap ────────────────────────────────────────── */}
        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            {t("sensitivity.heatmapTitle")}
          </h3>
          <p className="text-[11px] text-zinc-400 mb-4">
            {t("sensitivity.heatmapDesc")}
          </p>

          <div className="overflow-x-auto">
            <table className="text-[11px] font-mono">
              <thead>
                <tr>
                  <th className="p-1 text-zinc-400 text-right pr-2">rᵢ \ g</th>
                  {gSteps.map((g) => (
                    <th key={g} className="p-1 text-zinc-400 text-center min-w-[52px]">
                      {formatPercent(g, 0)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riSteps.map((ri, ri_i) => (
                  <tr key={ri}>
                    <td className="p-1 text-zinc-400 text-right pr-2 font-semibold">
                      {formatPercent(ri, 0)}
                    </td>
                    {gSteps.map((g, g_i) => {
                      const diff = grid[ri_i][g_i];
                      return (
                        <td
                          key={g}
                          className="p-1 text-center font-medium rounded-sm"
                          style={{
                            backgroundColor: cellColor(diff),
                            color:
                              Math.abs(diff) / maxAbsDiff > 0.4
                                ? "#fff"
                                : "#3f3f46",
                          }}
                        >
                          {formatCompactHKD(diff)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── What-If Impact Analysis ────────────────────────── */}
        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            {t("sensitivity.tornadoTitle")}
          </h3>
          <p className="text-[11px] text-zinc-400 mb-3">
            {t("sensitivity.tornadoDesc")}
          </p>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px] text-zinc-500 mb-4">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-400" />
              {t("sensitivity.buyingSaves")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
              {t("sensitivity.rentingCosts")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-3 rounded-sm bg-zinc-400" />
              {t("sensitivity.breakeven")}
            </span>
          </div>

          <div className="space-y-4">
            {tornadoData.map((row) => {
              const minDiff = Math.min(row.lowDiff, row.highDiff);
              const maxDiff = Math.max(row.lowDiff, row.highDiff);
              const startPos = toPos(minDiff);
              const endPos = toPos(maxDiff);

              // Split at zero: left = diff < 0 (buying saves, red); right = diff > 0 (renting cheaper, green)
              const redStart = startPos;
              const redEnd = Math.min(endPos, zeroPos);
              const greenStart = Math.max(startPos, zeroPos);
              const greenEnd = endPos;

              const hasRed = redEnd > redStart + 0.2;
              const hasGreen = greenEnd > greenStart + 0.2;

              // Determine which end has a lower value and which end has higher
              // Show the param label that produces the min outcome on the left, max on the right
              const leftLabel =
                row.lowDiff <= row.highDiff ? row.lowLabel : row.highLabel;
              const rightLabel =
                row.lowDiff <= row.highDiff ? row.highLabel : row.lowLabel;

              return (
                <div key={row.name}>
                  {/* Row header */}
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-zinc-700">
                        {row.name}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {leftLabel} → {rightLabel}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-zinc-500">
                      {t("sensitivity.swing")} {formatCompactHKD(row.swing)}
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="relative h-7 bg-stone-100 rounded-md overflow-hidden">
                    {/* Zero / breakeven line */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-zinc-400 z-10"
                      style={{ left: `${zeroPos}%` }}
                    />

                    {/* Red bar (TCO < TCR → buying saves, good for buyer) */}
                    {hasRed && (
                      <div
                        className="absolute top-1 bottom-1 bg-red-400/80 rounded-sm"
                        style={{
                          left: `${redStart}%`,
                          width: `${redEnd - redStart}%`,
                        }}
                      />
                    )}

                    {/* Green bar (TCO > TCR → renting cheaper, bad for buyer) */}
                    {hasGreen && (
                      <div
                        className="absolute top-1 bottom-1 bg-green-500/80 rounded-sm"
                        style={{
                          left: `${greenStart}%`,
                          width: `${greenEnd - greenStart}%`,
                        }}
                      />
                    )}

                    {/* Left-end label (min diff) */}
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-[11px] font-mono font-semibold z-20 pointer-events-none"
                      style={{
                        left: `${startPos}%`,
                        transform: "translate(-100%, -50%)",
                        paddingRight: "4px",
                        color: minDiff < 0 ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {formatCompactHKD(minDiff)}
                    </span>

                    {/* Right-end label (max diff) */}
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-[11px] font-mono font-semibold z-20 pointer-events-none"
                      style={{
                        left: `${endPos}%`,
                        transform: "translate(0%, -50%)",
                        paddingLeft: "4px",
                        color: maxDiff < 0 ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {formatCompactHKD(maxDiff)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Axis labels */}
          <div className="flex justify-between text-[11px] text-zinc-400 mt-3 font-medium">
            <span>← {t("sensitivity.buyingSaves")}</span>
            <span>{t("sensitivity.rentingCosts")} →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
