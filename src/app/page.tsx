"use client";

import { usePropertyCalc } from "@/hooks/usePropertyCalc";
import { LanguageProvider, useLanguage } from "@/hooks/useLanguage";
import { AnalysisMode } from "@/lib/constants";
import SummaryCards from "@/components/SummaryCards";
import Calculator from "@/components/Calculator";
import CostBreakdown from "@/components/CostBreakdown";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import SensitivityChart from "@/components/SensitivityChart";
import FormulaReference from "@/components/FormulaReference";
import BTLSummaryCards from "@/components/BTLSummaryCards";
import BTLBreakdown from "@/components/BTLBreakdown";
import BTLTimeSeriesChart from "@/components/BTLTimeSeriesChart";
import BTLSensitivityChart from "@/components/BTLSensitivityChart";

function AppContent() {
  const { params, mode, setMode, updateParam, resetParams, results } = usePropertyCalc();
  const { locale, setLocale, t } = useLanguage();

  const langOptions: { key: "zh" | "tc" | "en"; label: string }[] = [
    { key: "zh", label: "简" },
    { key: "tc", label: "繁" },
    { key: "en", label: "EN" },
  ];

  const modeOptions: { key: AnalysisMode; labelKey: "mode.ownerOccupied" | "mode.buyToLet"; descKey: "mode.ownerDesc" | "mode.btlDesc" }[] = [
    { key: "owner-occupied", labelKey: "mode.ownerOccupied", descKey: "mode.ownerDesc" },
    { key: "buy-to-let", labelKey: "mode.buyToLet", descKey: "mode.btlDesc" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b border-stone-200/60 bg-[#faf6f0]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center relative">
          <div className="text-center">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              {t("header.title")}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t("header.subtitle")}
            </p>
          </div>
          <div className="absolute right-4 sm:right-6 lg:right-8 flex items-center gap-1 text-xs">
            {langOptions.map((opt, i) => (
              <span key={opt.key} className="flex items-center">
                {i > 0 && <span className="text-stone-300 mx-0.5">/</span>}
                {locale === opt.key ? (
                  <span className="font-bold text-stone-900">{opt.label}</span>
                ) : (
                  <button
                    onClick={() => setLocale(opt.key)}
                    className="text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                  >
                    {opt.label}
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Mode Switch */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex gap-3">
          {modeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className={`flex-1 sm:flex-none px-5 py-3 rounded-xl border-2 transition-all text-left ${
                mode === opt.key
                  ? "border-teal-500 bg-teal-50/60 shadow-sm"
                  : "border-stone-200 bg-[#faf8f5] hover:border-stone-300"
              }`}
            >
              <span className={`text-sm font-semibold ${
                mode === opt.key ? "text-teal-700" : "text-zinc-500"
              }`}>
                {t(opt.labelKey)}
              </span>
              <p className={`text-[11px] mt-0.5 ${
                mode === opt.key ? "text-teal-500" : "text-zinc-400"
              }`}>
                {t(opt.descKey)}
              </p>
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <section>
          {mode === "owner-occupied" ? (
            <SummaryCards results={results} />
          ) : (
            <BTLSummaryCards results={results} />
          )}
        </section>
        <section>
          <Calculator
            params={params}
            results={results}
            mode={mode}
            onUpdate={updateParam}
            onReset={resetParams}
          />
        </section>
        <section>
          {mode === "owner-occupied" ? (
            <CostBreakdown results={results} />
          ) : (
            <BTLBreakdown results={results} />
          )}
        </section>
        <section>
          {mode === "owner-occupied" ? (
            <TimeSeriesChart results={results} />
          ) : (
            <BTLTimeSeriesChart results={results} />
          )}
        </section>
        <section>
          {mode === "owner-occupied" ? (
            <SensitivityChart results={results} />
          ) : (
            <BTLSensitivityChart results={results} />
          )}
        </section>
        <section>
          <FormulaReference />
        </section>
      </main>

      <footer className="border-t border-stone-200/60 py-6 mt-10 bg-[#faf6f0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-zinc-400">
          <p>{t("footer.disclaimer")}</p>
          <p className="mt-1">{t("footer.data")}</p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
