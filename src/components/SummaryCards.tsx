"use client";

import { CalcResults } from "@/hooks/usePropertyCalc";
import { formatHKD, formatPercent, formatCompactHKD } from "@/lib/formatters";
import { useLanguage } from "@/hooks/useLanguage";
import HelpTip from "./HelpTip";

interface Props {
  results: CalcResults;
}

export default function SummaryCards({ results }: Props) {
  const { locale } = useLanguage();
  const {
    averageAnnualTco,
    averageAnnualTcr,
    monthlyPayment,
    breakevenG,
    singleYear,
    params,
  } = results;

  const isZh = locale !== "en";
  const N = params.projectionYears;
  const rentMinusBuy = averageAnnualTcr - averageAnnualTco;
  const buyIsBetter = rentMinusBuy > 0;

  const accentClasses: Record<string, string> = {
    teal: "border-teal-200/60 bg-[#faf8f5] shadow-sm",
    amber: "border-amber-200/60 bg-[#faf8f5] shadow-sm",
    indigo: "border-indigo-200/60 bg-[#faf8f5] shadow-sm",
  };
  const accentText: Record<string, string> = {
    teal: "text-teal-700",
    amber: "text-amber-700",
    indigo: "text-indigo-700",
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: TCO */}
      <div className={`rounded-xl border p-5 ${accentClasses.teal}`}>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
          <span>{isZh ? `买房真实成本（${N}年均/年）` : `True Cost of Owning (${N}yr avg/yr)`}</span>
          <HelpTip
            text={
              isZh
                ? "包含利息、持有费用、机会成本和交易费摊销，减去房产增值。不含本金偿还（本金转化为房产净值）"
                : "Includes interest, holding costs, opportunity cost, amortized transaction fees, minus appreciation. Excludes principal repayment (converts to equity)"
            }
          />
        </p>
        <p className={`text-2xl font-bold ${accentText.teal}`}>
          {formatCompactHKD(averageAnnualTco)}
        </p>
        <div className="mt-2 space-y-0.5 text-xs font-mono text-zinc-400">
          <div className="flex justify-between">
            <span>{isZh ? "利息" : "Interest"}</span>
            <span>{formatCompactHKD(singleYear.interestCost)}</span>
          </div>
          <div className="flex justify-between">
            <span>{isZh ? "持有+交易摊销" : "Holding+Txn"}</span>
            <span>{formatCompactHKD(singleYear.holdingExpenses + singleYear.buyingCostAmortized + singleYear.sellingCostAmortized)}</span>
          </div>
          <div className="flex justify-between">
            <span>{isZh ? "机会成本" : "Opp. cost"}</span>
            <span>{formatCompactHKD(singleYear.opportunityCost)}</span>
          </div>
          <div
            className={`flex justify-between ${
              singleYear.appreciation > 0
                ? "text-red-500"
                : singleYear.appreciation < 0
                  ? "text-green-500"
                  : "text-zinc-400"
            }`}
          >
            <span>− {isZh ? "增值" : "Appreciation"}</span>
            <span>−{formatCompactHKD(singleYear.appreciation)}</span>
          </div>
        </div>
      </div>

      {/* Card 2: TCR */}
      <div className={`rounded-xl border p-5 ${accentClasses.amber}`}>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
          <span>{isZh ? `租房真实成本（${N}年均/年）` : `True Cost of Renting (${N}yr avg/yr)`}</span>
          <HelpTip
            text={isZh ? "考虑租金年增长后的年均租房支出" : "Average annual rent expense accounting for annual rent growth"}
          />
        </p>
        <p className={`text-2xl font-bold ${accentText.amber}`}>
          {formatCompactHKD(averageAnnualTcr)}
        </p>
        <div className="mt-2 space-y-0.5 text-xs font-mono text-zinc-400">
          <div className="flex justify-between">
            <span>{isZh ? "首年月租" : "Year 1 rent"}</span>
            <span>{formatHKD(params.monthlyRent, true)}{isZh ? "/月" : "/mo"}</span>
          </div>
          <div className="flex justify-between">
            <span>{isZh ? "年均月租" : "Avg rent"} ({N}{isZh ? "年" : "yr"})</span>
            <span>{formatHKD(averageAnnualTcr / 12, true)}{isZh ? "/月" : "/mo"}</span>
          </div>
          <div className="flex justify-between text-zinc-400/60">
            <span>{isZh ? "租金年增" : "Rent growth"} {formatPercent(params.rentInflation)}</span>
          </div>
        </div>
      </div>

      {/* Card 3: Diff — CN: red = good (buying cheaper), green = bad */}
      <div
        className={`rounded-xl border p-5 bg-[#faf8f5] shadow-sm ${
          buyIsBetter ? "border-red-200/60" : "border-green-200/60"
        }`}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
          <span>{isZh ? "年度差额（租房 − 买房）" : "Annual Diff (Rent − Buy)"}</span>
          <HelpTip
            text={
              isZh
                ? "正数 = 租房成本更高 = 买房划算；负数 = 买房成本更高 = 租房划算"
                : "Positive = renting costs more = buying wins; Negative = owning costs more = renting wins"
            }
          />
        </p>
        <p className={`text-2xl font-bold ${buyIsBetter ? "text-red-600" : "text-green-700"}`}>
          {rentMinusBuy > 0 ? "+" : ""}
          {formatCompactHKD(rentMinusBuy)}
        </p>
        <p className={`mt-2 text-xs ${buyIsBetter ? "text-red-600/90" : "text-green-700/90"}`}>
          {buyIsBetter
            ? (isZh ? "正数 → 租房成本更高 → 买房更划算" : "Positive → renting costs more → buying wins")
            : (isZh ? "负数 → 买房成本更高 → 租房更划算" : "Negative → owning costs more → renting wins")}
        </p>
        <p className="text-xs font-mono text-zinc-400/70 mt-1">
          {formatCompactHKD(averageAnnualTcr)} − {formatCompactHKD(averageAnnualTco)}
        </p>
      </div>

      {/* Card 4: Breakeven */}
      <div className={`rounded-xl border p-5 ${accentClasses.indigo}`}>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
          <span>{isZh ? "盈亏平衡增值率" : "Breakeven Appreciation"}</span>
          <HelpTip
            text={
              isZh
                ? "当房价年增值率达到此值时，买房和租房的总成本恰好相等"
                : "The annual appreciation rate at which total cost of owning equals total cost of renting"
            }
          />
        </p>
        <p className={`text-2xl font-bold ${accentText.indigo}`}>
          {formatPercent(breakevenG)}
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          {isZh
            ? "房价年增值 ≥ 此值时，买房比租房划算"
            : "Owning beats renting when annual appreciation ≥ this rate"}
        </p>
        <p
          className={`text-xs font-mono mt-1 ${
            params.appreciationRate > 0
              ? "text-red-600"
              : params.appreciationRate < 0
                ? "text-green-700"
                : "text-zinc-400/70"
          }`}
        >
          {isZh ? "当前增值率" : "Current g"}: {formatPercent(params.appreciationRate)}
        </p>
      </div>
    </div>
  );
}
