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
} from "recharts";
import { CalcResults } from "@/hooks/usePropertyCalc";
import { formatCompactHKD } from "@/lib/formatters";
import { useLanguage } from "@/hooks/useLanguage";
import { TranslationKey } from "@/lib/i18n";

interface Props {
  results: CalcResults;
}

type ViewMode = "annual" | "cumulative" | "wealth";

const TAB_KEYS: { key: ViewMode; labelKey: TranslationKey }[] = [
  { key: "annual", labelKey: "timeseries.annual" },
  { key: "cumulative", labelKey: "timeseries.cumulative" },
  { key: "wealth", labelKey: "timeseries.wealth" },
];

export default function TimeSeriesChart({ results }: Props) {
  const [view, setView] = useState<ViewMode>("annual");
  const { t } = useLanguage();
  const { projection } = results;

  const lastYear = projection[projection.length - 1];
  const ownerLarger = lastYear
    ? lastYear.ownerNetWealth >= lastYear.renterNetWealth
    : true;

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
        <p className="text-zinc-400 mb-1">{t("timeseries.year")} {label}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: entry.color }}
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-800">
          {t("timeseries.title")}
        </h2>
        <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
          {TAB_KEYS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === tab.key
                  ? "bg-white text-zinc-800 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
        <ResponsiveContainer width="100%" height={360}>
          {view === "annual" ? (
            <LineChart data={projection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis
                dataKey="year"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#a1a1aa", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCompactHKD(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", color: "#71717a" }}
              />
              <Line
                name={t("timeseries.ownTco")}
                type="monotone"
                dataKey="tcoAnnual"
                stroke="#0d9488"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "#0d9488" }}
              />
              <Line
                name={t("timeseries.rentTcr")}
                type="monotone"
                dataKey="tcrAnnual"
                stroke="#ea580c"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "#ea580c" }}
              />
            </LineChart>
          ) : view === "cumulative" ? (
            <AreaChart data={projection}>
              <defs>
                <linearGradient id="gradTco" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradTcr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ea580c" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ea580c" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis
                dataKey="year"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#a1a1aa", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCompactHKD(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", color: "#71717a" }}
              />
              <Area
                name={t("timeseries.ownCumulative")}
                type="monotone"
                dataKey="tcoCumulative"
                stroke="#0d9488"
                fill="url(#gradTco)"
                strokeWidth={2}
              />
              <Area
                name={t("timeseries.rentCumulative")}
                type="monotone"
                dataKey="tcrCumulative"
                stroke="#ea580c"
                fill="url(#gradTcr)"
                strokeWidth={2}
              />
            </AreaChart>
          ) : (
            <AreaChart data={projection}>
              <defs>
                <linearGradient id="gradOwner" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradRenter" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ea580c" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ea580c" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis
                dataKey="year"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#a1a1aa", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCompactHKD(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", color: "#71717a" }}
              />
              {ownerLarger ? (
                <>
                  <Area
                    name={t("timeseries.ownerWealth")}
                    type="monotone"
                    dataKey="ownerNetWealth"
                    stroke="#0d9488"
                    fill="url(#gradOwner)"
                    strokeWidth={2}
                  />
                  <Area
                    name={t("timeseries.renterPortfolio")}
                    type="monotone"
                    dataKey="renterNetWealth"
                    stroke="#ea580c"
                    fill="url(#gradRenter)"
                    strokeWidth={2}
                  />
                </>
              ) : (
                <>
                  <Area
                    name={t("timeseries.renterPortfolio")}
                    type="monotone"
                    dataKey="renterNetWealth"
                    stroke="#ea580c"
                    fill="url(#gradRenter)"
                    strokeWidth={2}
                  />
                  <Area
                    name={t("timeseries.ownerWealth")}
                    type="monotone"
                    dataKey="ownerNetWealth"
                    stroke="#0d9488"
                    fill="url(#gradOwner)"
                    strokeWidth={2}
                  />
                </>
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
