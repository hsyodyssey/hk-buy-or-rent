"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { CalcResults } from "@/hooks/usePropertyCalc";
import { formatCompactHKD, formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  results: CalcResults;
}

type BTLView = "cashFlow" | "wealth" | "yield";

export default function BTLTimeSeriesChart({ results }: Props) {
  const [view, setView] = useState<BTLView>("cashFlow");
  const { locale } = useLanguage();
  const { btlProjection, params } = results;
  const isZh = locale !== "en";

  const cashFlowData = btlProjection.map((d) => ({
    ...d,
    totalOutgoing: d.mortgagePayment + d.holdingExpenses,
  }));

  const tabs: { key: BTLView; label: string }[] = [
    { key: "cashFlow", label: isZh ? "现金流" : "Cash Flow" },
    { key: "wealth", label: isZh ? "终值对比" : "Ending Wealth" },
    { key: "yield", label: isZh ? "回报趋势" : "Yield Trend" },
  ];

  const subtitles: Record<BTLView, string> = {
    cashFlow: isZh
      ? "每年：租金收入 vs 总支出（按揭+管理+差饷），差值 = 净现金流"
      : "Annual: rental income vs total outgoing (mortgage + holding), difference = net cash flow",
    wealth: isZh
      ? `${params.projectionYears}年后：收租投资终值（房产净值+累计现金流）vs 纯投资终值（首付本金+避免的亏损额，按 ${formatPercent(params.opportunityCostRate)} 年化）`
      : `After ${params.projectionYears}yr: property investor ending wealth (equity + cash) vs alternative investor (capital + avoided shortfalls, at ${formatPercent(params.opportunityCostRate)} p.a.)`,
    yield: isZh
      ? "毛回报率 = 年租金 ÷ 当年房价 | 净回报率 = (租金 − 空置 − 持有) ÷ 当年房价"
      : "Gross = annual rent ÷ property value | Net = (rent − vacancy − holding) ÷ property value",
  };

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs shadow-lg">
        <p className="text-zinc-400 mb-1">{isZh ? "第" : "Year "}{label}{isZh ? "年" : ""}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
            <span className="text-zinc-500">{entry.name}:</span>
            <span className="font-semibold text-zinc-800">
              {view === "yield" ? formatPercent(entry.value, 2) : formatCompactHKD(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-800">
          {isZh ? "多年趋势" : "Multi-Year Projection"}
        </h2>
        <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === tab.key
                  ? "bg-white text-zinc-800 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-400 -mt-2">{subtitles[view]}</p>

      <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
        <ResponsiveContainer width="100%" height={360}>
          {view === "cashFlow" ? (
            <LineChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="year" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactHKD(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", color: "#71717a" }} />
              <ReferenceLine y={0} stroke="#a1a1aa" strokeDasharray="3 3" />
              <Line
                name={isZh ? "有效租金收入（扣空置）" : "Effective Rental Income (−vacancy)"}
                type="monotone" dataKey="rentalIncome" stroke="#059669" strokeWidth={2.5} dot={false}
              />
              <Line
                name={isZh ? "总支出（按揭+管理+差饷）" : "Total Outgoing (mortgage+holding)"}
                type="monotone" dataKey="totalOutgoing" stroke="#e11d48" strokeWidth={2.5} dot={false}
              />
              <Line
                name={isZh ? "净现金流（收入−支出）" : "Net Cash Flow (income−outgoing)"}
                type="monotone" dataKey="cashFlow" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={false}
              />
            </LineChart>
          ) : view === "wealth" ? (
            <AreaChart data={btlProjection}>
              <defs>
                <linearGradient id="gradInvestor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradAlt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ea580c" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ea580c" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="year" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactHKD(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", color: "#71717a" }} />
              {(() => {
                const last = btlProjection[btlProjection.length - 1];
                const investorLarger = last ? last.investorWealth >= last.alternativeWealth : true;
                const investorLabel = isZh
                  ? "收租投资终值（房产净值+现金）"
                  : "Property Investor (equity + cash)";
                const altLabel = isZh
                  ? `纯投资终值（首付按 ${formatPercent(params.opportunityCostRate)} 年化）`
                  : `Alternative (capital at ${formatPercent(params.opportunityCostRate)} p.a.)`;
                return investorLarger ? (
                  <>
                    <Area name={investorLabel} type="monotone" dataKey="investorWealth" stroke="#0d9488" fill="url(#gradInvestor)" strokeWidth={2} />
                    <Area name={altLabel} type="monotone" dataKey="alternativeWealth" stroke="#ea580c" fill="url(#gradAlt)" strokeWidth={2} />
                  </>
                ) : (
                  <>
                    <Area name={altLabel} type="monotone" dataKey="alternativeWealth" stroke="#ea580c" fill="url(#gradAlt)" strokeWidth={2} />
                    <Area name={investorLabel} type="monotone" dataKey="investorWealth" stroke="#0d9488" fill="url(#gradInvestor)" strokeWidth={2} />
                  </>
                );
              })()}
            </AreaChart>
          ) : (
            <LineChart data={btlProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="year" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatPercent(v, 1)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", color: "#71717a" }} />
              <Line
                name={isZh ? "毛回报率（年租 ÷ 房价）" : "Gross Yield (rent ÷ value)"}
                type="monotone" dataKey="grossYield" stroke="#d97706" strokeWidth={2.5} dot={false}
              />
              <Line
                name={isZh ? "净回报率（净租金 ÷ 房价）" : "Net Yield (NOI ÷ value)"}
                type="monotone" dataKey="netYield" stroke="#059669" strokeWidth={2.5} dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
