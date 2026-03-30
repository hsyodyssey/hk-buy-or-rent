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
                ? "经济成本 ≠ 现金支出！TCO = 利息 + 持有 + 首付放弃收益 + 交易费摊销 − 增值。不含本金偿还（转化为净值）。下方「年度现金支出」展示实际掏钱金额"
                : "Economic cost ≠ cash outflow! TCO = interest + holding + foregone returns + txn − appreciation. Excludes principal (builds equity). See 'Annual Cash Outflow' below for actual spending"
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
            <span>{isZh ? "首付放弃收益" : "Foregone returns"}
              <HelpTip text={isZh
                ? "如果不买房，首付这笔钱拿去投资每年能赚多少。买了房这笔收益就放弃了，所以算作成本"
                : "Returns you could have earned by investing your down payment instead of buying. This forgone income counts as a cost of owning"
              } />
            </span>
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

        {(() => {
          const effectiveLoanYears = Math.min(params.loanTermYears, N);
          const avgAnnualMortgage = monthlyPayment * 12 * effectiveLoanYears / N;
          const avgAnnualPrincipal = avgAnnualMortgage - singleYear.interestCost;
          const avgAnnualCashOut = avgAnnualMortgage + singleYear.holdingExpenses;
          const trueCostCash = singleYear.interestCost + singleYear.holdingExpenses + singleYear.buyingCostAmortized + singleYear.sellingCostAmortized;
          return (
            <div className="mt-3 pt-3 border-t border-teal-200/40 space-y-1 text-xs font-mono">
              <div className="flex justify-between font-semibold text-zinc-600">
                <span>{isZh ? "年度现金支出" : "Annual Cash Outflow"}
                  <HelpTip text={isZh
                    ? "每年实际从口袋掏出的钱 = 月供×12 + 持有费用。注意：这不等于「成本」，因为月供里的本金会转化为房产净值"
                    : "Actual cash paid per year = mortgage×12 + holding. Note: this ≠ cost, since principal in mortgage builds equity"
                  } />
                </span>
                <span>{formatCompactHKD(avgAnnualCashOut)}</span>
              </div>
              <div className="flex justify-between text-zinc-400/80">
                <span className="pl-2">{isZh ? "月供 ×12" : "Mortgage ×12"}</span>
                <span>{formatCompactHKD(avgAnnualMortgage)}</span>
              </div>
              <div className="flex justify-between text-zinc-400/80">
                <span className="pl-2">{isZh ? "持有费用" : "Holding"}</span>
                <span>{formatCompactHKD(singleYear.holdingExpenses)}</span>
              </div>

              <div className="pt-1 space-y-0.5">
                <div className="flex justify-between text-green-600">
                  <span>{isZh ? "其中消费（花掉了）" : "Spent (true cost)"}
                    <HelpTip text={isZh
                      ? "利息 + 持有 + 交易费摊销：这些钱花出去就没了"
                      : "Interest + holding + txn amortized: money that is gone"
                    } />
                  </span>
                  <span>{formatCompactHKD(trueCostCash)}</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>{isZh ? "其中资产置换（存下了）" : "Equity built (forced savings)"}
                    <HelpTip text={isZh
                      ? "月供中偿还本金的部分：钱从银行存款变成了房产净值，并没有消失"
                      : "Principal portion of mortgage: cash converts to home equity, not lost"
                    } />
                  </span>
                  <span>{formatCompactHKD(avgAnnualPrincipal)}</span>
                </div>
              </div>
            </div>
          );
        })()}
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
