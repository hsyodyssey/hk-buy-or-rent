"use client";

import { useMemo } from "react";
import { CalcResults } from "@/hooks/usePropertyCalc";
import { formatCompactHKD, formatPercent, formatHKD } from "@/lib/formatters";
import { calcBTLSingleYear } from "@/lib/calculator";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  results: CalcResults;
}

interface TornadoRow {
  name: string;
  lowLabel: string;
  highLabel: string;
  lowVal: number;
  highVal: number;
  swing: number;
}

export default function BTLSensitivityChart({ results }: Props) {
  const { t, locale } = useLanguage();
  const { params } = results;

  const rentSteps = useMemo(
    () => Array.from({ length: 11 }, (_, i) => Math.round(params.monthlyRent * (0.5 + i * 0.1))),
    [params.monthlyRent]
  );
  const gSteps = useMemo(
    () => Array.from({ length: 11 }, (_, i) => -0.02 + i * 0.01),
    []
  );

  const grid = useMemo(() => {
    return rentSteps.map((rent) =>
      gSteps.map((g) => {
        const modified = { ...params, monthlyRent: rent, appreciationRate: g };
        const r = calcBTLSingleYear(modified);
        return r.annualCashFlow + r.appreciation;
      })
    );
  }, [params, rentSteps, gSteps]);

  const maxAbsVal = useMemo(() => {
    let max = 0;
    for (const row of grid) {
      for (const v of row) {
        if (Math.abs(v) > max) max = Math.abs(v);
      }
    }
    return max || 1;
  }, [grid]);

  function cellColor(val: number): string {
    const intensity = Math.min(Math.abs(val) / maxAbsVal, 1);
    if (val >= 0) {
      const r = Math.round(220 + intensity * 35);
      const g = Math.round(160 - intensity * 80);
      const b = Math.round(140 - intensity * 60);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const r = Math.round(180 - intensity * 80);
      const g = Math.round(220 + intensity * 25);
      const b = Math.round(200 + intensity * 20);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

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
      { nameKey: "sensitivity.appreciation", key: "appreciationRate", low: -0.03, high: 0.05, lowMult: 0, highMult: 0, fmtParam: (v) => formatPercent(v, 1) },
      { nameKey: "sensitivity.monthlyRent", key: "monthlyRent", low: null, high: null, lowMult: 0.7, highMult: 1.3, fmtParam: (v) => formatCompactHKD(v) },
      { nameKey: "sensitivity.mortgageRate", key: "mortgageRate", low: 0.02, high: 0.06, lowMult: 0, highMult: 0, fmtParam: (v) => formatPercent(v, 1) },
      { nameKey: "sensitivity.propertyPrice", key: "propertyPrice", low: null, high: null, lowMult: 0.8, highMult: 1.2, fmtParam: (v) => formatCompactHKD(v) },
      { nameKey: "calc.vacancyRate", key: "vacancyRate", low: 0, high: 0.15, lowMult: 0, highMult: 0, fmtParam: (v) => formatPercent(v, 0) },
      { nameKey: "sensitivity.ltvRatio", key: "ltvRatio", low: 0.3, high: 0.9, lowMult: 0, highMult: 0, fmtParam: (v) => formatPercent(v, 0) },
    ];

    return tests
      .map((test) => {
        const baseVal = params[test.key] as number;
        const lowVal = test.low !== null ? test.low : baseVal * test.lowMult;
        const highVal = test.high !== null ? test.high : baseVal * test.highMult;

        const lowResult = calcBTLSingleYear({ ...params, [test.key]: lowVal });
        const highResult = calcBTLSingleYear({ ...params, [test.key]: highVal });

        const lowNet = lowResult.annualCashFlow + lowResult.appreciation;
        const highNet = highResult.annualCashFlow + highResult.appreciation;

        return {
          name: t(test.nameKey as Parameters<typeof t>[0]),
          lowLabel: test.fmtParam(lowVal),
          highLabel: test.fmtParam(highVal),
          lowVal: lowNet,
          highVal: highNet,
          swing: Math.abs(highNet - lowNet),
        };
      })
      .sort((a, b) => b.swing - a.swing);
  }, [params, t]);

  const { globalMin, globalMax } = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const row of tornadoData) {
      min = Math.min(min, row.lowVal, row.highVal);
      max = Math.max(max, row.lowVal, row.highVal);
    }
    const pad = (max - min) * 0.05;
    return { globalMin: min - pad, globalMax: max + pad };
  }, [tornadoData]);

  const toPos = (v: number) =>
    ((v - globalMin) / (globalMax - globalMin)) * 100;
  const zeroPos = toPos(0);

  const isZh = locale !== "en";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800">
          {t("sensitivity.title")}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {isZh
            ? "衡量指标：年化净回报 = 净现金流 + 房价增值（年均）"
            : "Metric: Annual Net Return = Net Cash Flow + Appreciation (annualized)"}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Heatmap */}
        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            {isZh ? "净回报热力图：月租金 × 增值率" : "Net Return Heatmap: Rent × Appreciation"}
          </h3>
          <p className="text-xs text-zinc-400 mb-4">
            {isZh
              ? "红色 = 正回报（物业赚钱）| 绿色 = 负回报（物业亏钱）"
              : "Red = positive return (property gains) | Green = negative return (property loses)"}
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs font-mono">
              <thead>
                <tr>
                  <th className="p-1 text-zinc-400 text-right pr-2">rent \ g</th>
                  {gSteps.map((g) => (
                    <th key={g} className="p-1 text-zinc-400 text-center min-w-[52px]">
                      {formatPercent(g, 0)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rentSteps.map((rent, ri) => (
                  <tr key={rent}>
                    <td className="p-1 text-zinc-400 text-right pr-2 font-semibold">
                      {formatHKD(rent, true)}
                    </td>
                    {gSteps.map((g, gi) => {
                      const val = grid[ri][gi];
                      return (
                        <td
                          key={g}
                          className="p-1 text-center font-medium rounded-sm"
                          style={{
                            backgroundColor: cellColor(val),
                            color: Math.abs(val) / maxAbsVal > 0.4 ? "#fff" : "#3f3f46",
                          }}
                        >
                          {formatCompactHKD(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* What-If */}
        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            {t("sensitivity.tornadoTitle")}
          </h3>
          <p className="text-xs text-zinc-400 mb-3">
            {isZh
              ? "单独调整每个变量时，年化净回报（现金流+增值）的变化范围"
              : "Range of annual net return (cash flow + appreciation) when varying each parameter alone"}
          </p>

          <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-400" />
              {t("btl.sensitivity.positive")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
              {t("btl.sensitivity.negative")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-3 rounded-sm bg-zinc-400" />
              {t("sensitivity.breakeven")}
            </span>
          </div>

          <div className="space-y-4">
            {tornadoData.map((row) => {
              const minVal = Math.min(row.lowVal, row.highVal);
              const maxVal = Math.max(row.lowVal, row.highVal);
              const startPos = toPos(minVal);
              const endPos = toPos(maxVal);

              const greenStart = Math.max(startPos, zeroPos);
              const greenEnd = endPos;
              const roseStart = startPos;
              const roseEnd = Math.min(endPos, zeroPos);

              const hasGreen = greenEnd > greenStart + 0.2;
              const hasRose = roseEnd > roseStart + 0.2;

              const leftLabel = row.lowVal <= row.highVal ? row.lowLabel : row.highLabel;
              const rightLabel = row.lowVal <= row.highVal ? row.highLabel : row.lowLabel;

              return (
                <div key={row.name}>
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-zinc-700">{row.name}</span>
                      <span className="text-xs text-zinc-400">{leftLabel} → {rightLabel}</span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-zinc-500">
                      {t("sensitivity.swing")} {formatCompactHKD(row.swing)}
                    </span>
                  </div>
                  <div className="relative h-7 bg-stone-100 rounded-md overflow-hidden">
                    <div className="absolute top-0 bottom-0 w-px bg-zinc-400 z-10" style={{ left: `${zeroPos}%` }} />
                    {hasGreen && (
                      <div className="absolute top-1 bottom-1 bg-red-400/80 rounded-sm" style={{ left: `${greenStart}%`, width: `${greenEnd - greenStart}%` }} />
                    )}
                    {hasRose && (
                      <div className="absolute top-1 bottom-1 bg-green-500/80 rounded-sm" style={{ left: `${roseStart}%`, width: `${roseEnd - roseStart}%` }} />
                    )}
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-xs font-mono font-semibold z-20 pointer-events-none"
                      style={{ left: `${startPos}%`, transform: "translate(-100%, -50%)", paddingRight: "4px", color: minVal >= 0 ? "#dc2626" : "#16a34a" }}
                    >
                      {formatCompactHKD(minVal)}
                    </span>
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-xs font-mono font-semibold z-20 pointer-events-none"
                      style={{ left: `${endPos}%`, transform: "translate(0%, -50%)", paddingLeft: "4px", color: maxVal >= 0 ? "#dc2626" : "#16a34a" }}
                    >
                      {formatCompactHKD(maxVal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-xs text-zinc-400 mt-3 font-medium">
            <span>← {t("btl.sensitivity.negative")}</span>
            <span>{t("btl.sensitivity.positive")} →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
