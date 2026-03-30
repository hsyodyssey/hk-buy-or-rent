"use client";

import { STAMP_DUTY_BRACKETS } from "@/lib/constants";
import { useLanguage } from "@/hooks/useLanguage";

export default function FormulaReference() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-800">
        {t("ref.title")}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            {t("ref.formulaTitle")}
          </h3>
          <div className="space-y-4 text-sm text-zinc-600">
            <div className="bg-stone-50 rounded-lg p-4 font-mono text-xs leading-relaxed border border-stone-200/40">
              <p className="text-teal-700 mb-2">{t("ref.tcoLabel")}</p>
              <p className="pl-2 text-zinc-800">
                TCO = (L &times; r<sub>m</sub>) + E + (C &times; r<sub>i</sub>) &minus; (P &times; g)
              </p>
              <p className="text-amber-700 mt-3 mb-2">{t("ref.tcrLabel")}</p>
              <p className="pl-2 text-zinc-800">{t("ref.tcrFormula")}</p>
              <p className="text-indigo-700 mt-3 mb-2">{t("ref.decisionRule")}</p>
              <p className="pl-2 text-zinc-800">{t("ref.decisionText")}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
              <div><span className="text-zinc-800 font-semibold">P</span> = {t("ref.varP")}</div>
              <div><span className="text-zinc-800 font-semibold">L</span> = {t("ref.varL")}</div>
              <div><span className="text-zinc-800 font-semibold">r<sub>m</sub></span> = {t("ref.varRm")}</div>
              <div><span className="text-zinc-800 font-semibold">E</span> = {t("ref.varE")}</div>
              <div><span className="text-zinc-800 font-semibold">C</span> = {t("ref.varC")}</div>
              <div><span className="text-zinc-800 font-semibold">r<sub>i</sub></span> = {t("ref.varRi")}</div>
              <div><span className="text-zinc-800 font-semibold">g</span> = {t("ref.varG")}</div>
              <div><span className="text-zinc-800 font-semibold">R</span> = {t("ref.varR")}</div>
            </div>

            <div className="border-t border-stone-200/40 pt-3 text-xs text-zinc-400">
              <p className="font-semibold text-zinc-600 mb-1">{t("ref.insightTitle")}</p>
              <p>{t("ref.insightText")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">
            {t("ref.stampDutyTitle")}
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-400 border-b border-stone-200/60">
                <th className="text-left py-2 font-medium">{t("ref.propertyValue")}</th>
                <th className="text-right py-2 font-medium">{t("ref.rate")}</th>
              </tr>
            </thead>
            <tbody>
              {STAMP_DUTY_BRACKETS.map((b, i) => (
                <tr
                  key={i}
                  className="border-b border-stone-100 text-zinc-600"
                >
                  <td className="py-2">
                    {b.max === Infinity
                      ? `> HK$${(b.min - 1).toLocaleString()}`
                      : `HK$${b.min.toLocaleString()} — HK$${b.max.toLocaleString()}`}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-teal-700">
                    {b.rate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 border-t border-stone-200/40 pt-3 text-xs text-zinc-400 space-y-2">
            <p className="font-semibold text-zinc-600">{t("ref.holdingCostsTitle")}</p>
            <div className="grid grid-cols-2 gap-1">
              <span>{t("ref.managementFee")}</span><span className="text-right">HK$2,000 — HK$5,000</span>
              <span>{t("ref.rates")}</span><span className="text-right">~5% of rateable value</span>
              <span>{t("ref.groundRent")}</span><span className="text-right">~3% of rateable value</span>
            </div>
            <p className="font-semibold text-zinc-600 pt-2">{t("ref.mortgageRef")}</p>
            <p>{t("ref.mortgageRefText")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
