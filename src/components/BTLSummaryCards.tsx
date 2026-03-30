"use client";

import { CalcResults } from "@/hooks/usePropertyCalc";
import { formatHKD, formatPercent, formatCompactHKD } from "@/lib/formatters";
import { useLanguage } from "@/hooks/useLanguage";
import HelpTip from "./HelpTip";

interface Props {
  results: CalcResults;
}

const profitCard = "border-red-200/60 bg-[#faf8f5]";
const lossCard = "border-green-200/60 bg-[#faf8f5]";
const amberCard = "border-amber-200/60 bg-[#faf8f5]";
const indigoCard = "border-indigo-200/60 bg-[#faf8f5]";

const profitText = "text-red-600";
const lossText = "text-green-700";
const amberText = "text-amber-700";
const indigoText = "text-indigo-700";

export default function BTLSummaryCards({ results }: Props) {
  const { locale } = useLanguage();
  const { monthlyPayment, params, btlProjection, upfront, btl } = results;

  const isZh = locale !== "en";

  // First-year values
  const monthlyRentAfterVacancy = params.monthlyRent * (1 - params.vacancyRate);
  const monthlyHolding = params.monthlyMgmtFee + params.propertyPrice * params.holdingExpenseRate / 12;
  const monthlyCF = monthlyRentAfterVacancy - monthlyPayment - monthlyHolding;

  // First-year interest vs principal split
  const loan = params.propertyPrice * params.ltvRatio;
  const monthlyRate = params.mortgageRate / 12;
  const firstYearMonthlyInterest = loan * monthlyRate;
  const firstYearMonthlyPrincipal = monthlyPayment - firstYearMonthlyInterest;
  const monthlyEconomicProfit = monthlyRentAfterVacancy - firstYearMonthlyInterest - monthlyHolding;

  const annualRent = params.monthlyRent * 12;
  const annualEffective = annualRent * (1 - params.vacancyRate);
  const annualHolding = btl.holdingExpenses;
  const noi = annualEffective - annualHolding;

  const lastYear = btlProjection[btlProjection.length - 1];
  const investorW = lastYear?.investorWealth ?? 0;
  const altW = lastYear?.alternativeWealth ?? 0;
  const diff = investorW - altW;
  const N = params.projectionYears;

  const card1Class = monthlyCF >= 0 ? profitCard : lossCard;
  const card1Text = monthlyCF >= 0 ? profitText : lossText;

  const card3Class = btl.netYield >= 0 ? profitCard : lossCard;
  const card3Text = btl.netYield >= 0 ? profitText : lossText;

  const card4Class = diff > 0 ? profitCard : diff < 0 ? lossCard : indigoCard;
  const card4Text = diff > 0 ? profitText : diff < 0 ? lossText : indigoText;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: First-year monthly cash flow */}
      <div className={`rounded-xl border p-5 shadow-sm ${card1Class}`}>
        <p className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-2 flex items-center flex-wrap gap-x-1">
          {isZh ? "首年每月现金流" : "Year 1 Monthly Cash Flow"}
          <HelpTip
            text={
              isZh
                ? "现金流 = 租金 − 月供 − 持有。注意：现金流为负不等于亏钱！月供中的本金偿还部分会转化为房产净值（相当于强制储蓄），真正的成本只有利息和持有费"
                : "Cash flow = rent − mortgage − holding. Note: negative CF ≠ losing money! Principal in mortgage payments builds equity (forced savings). True costs are only interest + holding"
            }
          />
        </p>
        <p className={`text-2xl font-bold ${card1Text}`}>
          {formatCompactHKD(monthlyCF)}
        </p>
        <div className="mt-2 space-y-0.5 text-xs font-mono">
          <div className="flex justify-between text-zinc-400">
            <span>{isZh ? "月租收入" : "Rent"} (−{formatPercent(params.vacancyRate, 0)}{isZh ? "空置" : " vacancy"})</span>
            <span>{formatHKD(monthlyRentAfterVacancy, true)}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>− {isZh ? "月供" : "Mortgage"}</span>
            <span className="text-zinc-500">−{formatHKD(monthlyPayment, true)}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>− {isZh ? "管理+差饷" : "Holding"}</span>
            <span className="text-zinc-500">−{formatHKD(monthlyHolding, true)}</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-zinc-200/50 space-y-0.5 text-xs font-mono">
          <div className="flex justify-between text-zinc-400/70">
            <span>{isZh ? "其中月供含利息" : "Of mortgage: interest"}</span>
            <span>{formatHKD(firstYearMonthlyInterest, true)}</span>
          </div>
          <div className="flex justify-between text-zinc-400/70">
            <span>{isZh ? "其中月供含本金" : "Of mortgage: principal"}</span>
            <span>{formatHKD(firstYearMonthlyPrincipal, true)}</span>
          </div>
          <div className={`flex justify-between font-semibold ${monthlyEconomicProfit >= 0 ? "text-red-500" : "text-green-600"}`}>
            <span>{isZh ? "经济利润（扣利息+持有）" : "Economic profit (excl. principal)"}</span>
            <span>{monthlyEconomicProfit >= 0 ? "+" : ""}{formatHKD(monthlyEconomicProfit, true)}</span>
          </div>
        </div>
      </div>

      {/* Card 2: Gross yield */}
      <div className={`rounded-xl border p-5 shadow-sm ${amberCard}`}>
        <p className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-2 flex items-center flex-wrap gap-x-1">
          {isZh ? "毛租金回报率" : "Gross Rental Yield"}
          <HelpTip
            text={
              isZh
                ? "年租金总额 ÷ 物业价格。未扣除任何成本，仅衡量租金与房价的比率"
                : "Annual gross rent ÷ property price. Before any cost deductions, measures rent-to-price ratio"
            }
          />
        </p>
        <p className={`text-2xl font-bold ${amberText}`}>
          {formatPercent(btl.grossYield, 2)}
        </p>
        <div className="mt-2 text-xs font-mono text-zinc-400">
          <span>{formatCompactHKD(annualRent)}</span>
          <span className="mx-1">÷</span>
          <span>{formatCompactHKD(params.propertyPrice)}</span>
        </div>
        <p className="text-xs text-zinc-400/70 mt-1">
          {isZh ? "年租金 ÷ 房价（未扣任何成本）" : "Annual rent ÷ price (before any costs)"}
        </p>
      </div>

      {/* Card 3: Net yield (NOI / price) */}
      <div className={`rounded-xl border p-5 shadow-sm ${card3Class}`}>
        <p className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-2 flex items-center flex-wrap gap-x-1">
          {isZh ? "净租金回报率" : "Net Rental Yield"}{" "}
          <span className="normal-case text-zinc-400">(NOI ÷ {isZh ? "房价" : "Price"})</span>
          <HelpTip
            text={
              isZh
                ? "NOI（净营业收入）÷ 物业价格。NOI = 有效租金 − 空置损失 − 管理费 − 差饷地租，不含按揭"
                : "NOI (Net Operating Income) ÷ price. NOI = effective rent − vacancy − mgmt fee − rates. Excludes mortgage"
            }
          />
        </p>
        <p className={`text-2xl font-bold ${card3Text}`}>
          {formatPercent(btl.netYield, 2)}
        </p>
        <div className="mt-2 space-y-0.5 text-xs font-mono text-zinc-400">
          <div className="flex justify-between">
            <span>NOI</span>
            <span>{formatCompactHKD(noi)}{isZh ? "/年" : "/yr"}</span>
          </div>
          <div className="flex justify-between text-zinc-400/60">
            <span>= {isZh ? "年租" : "Rent"} − {isZh ? "空置" : "Vacancy"} − {isZh ? "持有成本" : "Holding"}</span>
          </div>
        </div>
      </div>

      {/* Card 4: N-year total comparison */}
      <div className={`rounded-xl border p-5 shadow-sm ${card4Class}`}>
        <p className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-2 flex items-center flex-wrap gap-x-1">
          {N}{isZh ? "年终值对比" : "yr Ending Wealth"}
          <HelpTip
            text={
              isZh
                ? "假设同一笔资金，分别投入买房收租和纯金融投资（按设定回报率），N年后的财富对比"
                : "Same capital deployed in property vs financial investment (at set return rate). Comparison after N years"
            }
          />
        </p>
        <p className={`text-2xl font-bold ${card4Text}`}>
          {diff > 0 ? "+" : ""}{formatCompactHKD(diff)}
        </p>
        <div className="mt-2 space-y-0.5 text-xs font-mono text-zinc-400">
          <div className="flex justify-between">
            <span>{isZh ? "收租投资" : "Property"}</span>
            <span>{formatCompactHKD(investorW)}</span>
          </div>
          <div className="flex justify-between">
            <span>{isZh ? "纯投资" : "Alternative"} ({formatPercent(params.opportunityCostRate)})</span>
            <span>{formatCompactHKD(altW)}</span>
          </div>
        </div>
        <p className="text-xs text-zinc-400/70 mt-1">
          {isZh ? "同等现金投入，不同方式" : "Same total cash outlay, different strategy"}
        </p>
      </div>
    </div>
  );
}
