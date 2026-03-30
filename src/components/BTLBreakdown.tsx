"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { CalcResults } from "@/hooks/usePropertyCalc";
import { formatCompactHKD, formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  results: CalcResults;
}

const COLORS = {
  rental: "#059669",
  principal: "#0ea5e9",
  interest: "#0d9488",
  holding: "#6366f1",
  buying: "#7c3aed",
  selling: "#be185d",
  totalCost: "#e11d48",
};

interface ChartItem {
  name: string;
  value: number;
  fill: string;
}

export default function BTLBreakdown({ results }: Props) {
  const { locale } = useLanguage();
  const { btl, params } = results;
  const isZh = locale !== "en";

  const principalPortion = btl.mortgagePayment - btl.interestCost;
  const totalOutgoing = btl.mortgagePayment + btl.holdingExpenses + btl.buyingCostAmortized + btl.sellingCostAmortized;

  const comparisonData: ChartItem[] = [
    {
      name: isZh ? "有效租金收入" : "Effective Rent",
      value: btl.rentalIncome,
      fill: COLORS.rental,
    },
    {
      name: isZh ? "总现金支出" : "Total Cash Outgoing",
      value: totalOutgoing,
      fill: COLORS.totalCost,
    },
  ];

  const costData: ChartItem[] = [
    {
      name: isZh ? "本金偿还（非成本）" : "Principal (not a cost)",
      value: principalPortion,
      fill: COLORS.principal,
    },
    {
      name: isZh ? "利息" : "Interest",
      value: btl.interestCost,
      fill: COLORS.interest,
    },
    {
      name: isZh ? "管理费+差饷" : "Mgmt+Rates",
      value: btl.holdingExpenses,
      fill: COLORS.holding,
    },
    {
      name: isZh ? `买入摊销 (÷${params.projectionYears}年)` : `Buy txn (÷${params.projectionYears}yr)`,
      value: btl.buyingCostAmortized,
      fill: COLORS.buying,
    },
    {
      name: isZh ? `卖出摊销 (÷${params.projectionYears}年)` : `Sell txn (÷${params.projectionYears}yr)`,
      value: btl.sellingCostAmortized,
      fill: COLORS.selling,
    },
  ];

  const pieData: ChartItem[] = [
    {
      name: isZh ? "利息" : "Interest",
      value: btl.interestCost,
      fill: COLORS.interest,
    },
    {
      name: isZh ? "本金偿还" : "Principal",
      value: principalPortion,
      fill: COLORS.principal,
    },
    {
      name: isZh ? "持有费用" : "Holding",
      value: btl.holdingExpenses,
      fill: COLORS.holding,
    },
    {
      name: isZh ? "交易摊销" : "Txn amortized",
      value: btl.buyingCostAmortized + btl.sellingCostAmortized,
      fill: COLORS.buying,
    },
  ].filter((d) => d.value > 0);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: ChartItem }>;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs shadow-lg">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: entry.payload.fill }}
            />
            <span className="text-zinc-500">{entry.name}:</span>
            <span className="font-semibold text-zinc-800">
              {formatCompactHKD(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800">
          {isZh ? "年均收支拆解" : "Annualized Income & Cost Breakdown"}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {isZh
            ? `所有数值为 ${params.projectionYears} 年均摊后的年化值 | 空置率 ${formatPercent(params.vacancyRate, 0)}`
            : `All values annualized over ${params.projectionYears} years | Vacancy ${formatPercent(params.vacancyRate, 0)}`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Income vs Outgoing */}
        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            {isZh ? "年租金 vs 年支出" : "Annual Rent vs Outgoing"}
          </h3>
          <p className="text-[11px] text-zinc-400/70 mb-4">
            {isZh ? "支出含按揭（本金+利息）+ 持有 + 交易摊销" : "Outgoing = mortgage (P+I) + holding + txn amortized"}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparisonData} barSize={48}>
              <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactHKD(v)} />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {comparisonData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Middle: Cost breakdown horizontal bars */}
        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            {isZh ? "支出构成明细" : "Outgoing Components"}
          </h3>
          <p className="text-[11px] text-zinc-400/70 mb-4">
            {isZh ? "注意：本金偿还转化为房产净值，并非真正的「成本」" : "Note: principal repayment builds equity, not a true \"cost\""}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={costData} barSize={32} layout="vertical">
              <XAxis type="number" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactHKD(v)} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={140} />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {costData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right: Pie of outgoing composition */}
        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            {isZh ? "支出占比" : "Outgoing Share"}
          </h3>
          <p className="text-[11px] text-zinc-400/70 mb-4">
            {isZh ? "每年总现金支出中各项占比" : "Proportion of each component in total annual outgoing"}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", color: "#71717a" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
