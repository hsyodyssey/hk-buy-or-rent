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
import { formatCompactHKD } from "@/lib/formatters";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  results: CalcResults;
}

const COLORS = {
  interest: "#0d9488",
  expenses: "#6366f1",
  opportunity: "#d97706",
  buying: "#7c3aed",
  selling: "#be185d",
  appreciation: "#059669",
  rent: "#ea580c",
};

interface BreakdownItem {
  name: string;
  value: number;
  fill: string;
  totalOnce?: number;
}

export default function CostBreakdown({ results }: Props) {
  const { t } = useLanguage();
  const { singleYear, upfront, params } = results;

  const perYr = t("breakdown.perYear");
  const buyingTotal = upfront.transactionCosts;
  const futurePrice =
    params.propertyPrice * Math.pow(1 + params.appreciationRate, params.projectionYears);
  const sellingTotal = futurePrice * params.sellingCostRate;

  const breakdownData: BreakdownItem[] = [
    { name: t("breakdown.interest"), value: singleYear.interestCost, fill: COLORS.interest },
    { name: t("breakdown.expenses"), value: singleYear.holdingExpenses, fill: COLORS.expenses },
    { name: t("breakdown.opportunity"), value: singleYear.opportunityCost, fill: COLORS.opportunity },
    {
      name: `${t("breakdown.buyingCost")} ${perYr}`,
      value: singleYear.buyingCostAmortized,
      fill: COLORS.buying,
      totalOnce: buyingTotal,
    },
    {
      name: `${t("breakdown.sellingCost")} ${perYr}`,
      value: singleYear.sellingCostAmortized,
      fill: COLORS.selling,
      totalOnce: sellingTotal,
    },
    ...(singleYear.appreciation > 0
      ? [{ name: t("breakdown.appreciationOffset"), value: -singleYear.appreciation, fill: COLORS.appreciation }]
      : []),
  ];

  const comparisonData: BreakdownItem[] = [
    { name: t("breakdown.ownTco"), value: singleYear.tco, fill: "#0d9488" },
    { name: t("breakdown.rentTcr"), value: singleYear.tcr, fill: "#ea580c" },
  ];

  const pieData: BreakdownItem[] = [
    { name: t("breakdown.interestShort"), value: singleYear.interestCost, fill: COLORS.interest },
    { name: t("breakdown.expensesShort"), value: singleYear.holdingExpenses, fill: COLORS.expenses },
    { name: t("breakdown.opportunityShort"), value: singleYear.opportunityCost, fill: COLORS.opportunity },
    {
      name: `${t("breakdown.buyingShort")} ${perYr}`,
      value: singleYear.buyingCostAmortized,
      fill: COLORS.buying,
      totalOnce: buyingTotal,
    },
    {
      name: `${t("breakdown.sellingShort")} ${perYr}`,
      value: singleYear.sellingCostAmortized,
      fill: COLORS.selling,
      totalOnce: sellingTotal,
    },
  ];

  const totalLabel = t("breakdown.total");

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: BreakdownItem }>;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs shadow-lg">
        {payload.map((entry, i) => (
          <div key={i}>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: entry.payload.fill }}
              />
              <span className="text-zinc-500">{entry.name}:</span>
              <span className="font-semibold text-zinc-800">
                {formatCompactHKD(entry.value)}
              </span>
            </div>
            {entry.payload.totalOnce != null && (
              <div className="ml-4 text-xs text-zinc-400">
                {totalLabel}: {formatCompactHKD(entry.payload.totalOnce)} ÷ {params.projectionYears}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800">
          {t("breakdown.title")}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {t("breakdown.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            {t("breakdown.tcoVsTcr")}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparisonData} barSize={48}>
              <XAxis
                dataKey="name"
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#a1a1aa", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCompactHKD(v)}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {comparisonData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            {t("breakdown.components")}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={breakdownData} barSize={40} layout="vertical">
              <XAxis
                type="number"
                tick={{ fill: "#a1a1aa", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCompactHKD(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={130}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {breakdownData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            {t("breakdown.composition")}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "12px", color: "#71717a" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
