"use client";

import { CalcParams, AnalysisMode } from "@/lib/constants";
import { formatHKD, formatPercent } from "@/lib/formatters";
import ParamSlider from "./ParamSlider";
import HelpTip from "./HelpTip";
import { CalcResults } from "@/hooks/usePropertyCalc";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  params: CalcParams;
  results: CalcResults;
  mode: AnalysisMode;
  onUpdate: <K extends keyof CalcParams>(key: K, value: CalcParams[K]) => void;
  onReset: () => void;
}

export default function Calculator({
  params,
  results,
  mode,
  onUpdate,
  onReset,
}: Props) {
  const { t, locale } = useLanguage();
  const isZh = locale !== "en";
  const { upfront } = results;

  const yearsSuffix = locale !== "en" ? "年" : " years";

  return (
    <div className="rounded-xl border border-stone-200/60 bg-[#faf8f5] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800">{t("calc.title")}</h2>
        <button
          onClick={onReset}
          className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors px-3 py-1 rounded-md border border-zinc-200 hover:border-zinc-400"
        >
          {t("calc.reset")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-5">
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-600 mb-3">
            {t("calc.propertyLoan")}
          </h3>
          <ParamSlider
            label={t("calc.propertyPrice")}
            value={params.propertyPrice}
            min={2_000_000}
            max={50_000_000}
            step={100_000}
            format={(v) => formatHKD(v, true)}
            parse={(v) => Number(v) * (v.length <= 4 ? 1_000_000 : 1)}
            onChange={(v) => onUpdate("propertyPrice", v)}
          />
          <ParamSlider
            label={t("calc.ltvRatio")}
            value={params.ltvRatio}
            min={0.1}
            max={0.9}
            step={0.05}
            format={(v) => formatPercent(v, 0)}
            parse={(v) => Number(v) / 100}
            onChange={(v) => onUpdate("ltvRatio", v)}
          />
          <ParamSlider
            label={t("calc.mortgageRate")}
            value={params.mortgageRate}
            min={0.01}
            max={0.08}
            step={0.0005}
            format={(v) => formatPercent(v, 2)}
            parse={(v) => Number(v) / 100}
            onChange={(v) => onUpdate("mortgageRate", v)}
          />
          <ParamSlider
            label={t("calc.loanTerm")}
            value={params.loanTermYears}
            min={5}
            max={30}
            step={1}
            format={(v) => `${v}${yearsSuffix}`}
            parse={(v) => Number(v)}
            onChange={(v) => onUpdate("loanTermYears", v)}
          />
          <ParamSlider
            label={t("calc.mortgageInsurance")}
            value={params.mortgageInsurancePct}
            min={0}
            max={0.05}
            step={0.005}
            format={(v) => formatPercent(v)}
            parse={(v) => Number(v) / 100}
            onChange={(v) => onUpdate("mortgageInsurancePct", v)}
          />

          <div className="mt-2 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2.5 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-teal-500">{t("calc.monthlyPayment")}</span>
              <span className="text-sm font-mono font-bold text-teal-700">{formatHKD(results.monthlyPayment, true)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-teal-500">{t("calc.loanAmount")}</span>
              <span className="text-xs font-mono font-semibold text-teal-600">{formatHKD(results.loanAmount, true)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {mode === "owner-occupied" ? (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-3">
                {t("calc.renting")}
              </h3>
              <ParamSlider
                label={t("calc.monthlyRent")}
                value={params.monthlyRent}
                min={5_000}
                max={150_000}
                step={1_000}
                format={(v) => formatHKD(v, true)}
                parse={(v) => Number(v) * (v.length <= 3 ? 1_000 : 1)}
                onChange={(v) => onUpdate("monthlyRent", v)}
              />
              <ParamSlider
                label={t("calc.rentInflation")}
                value={params.rentInflation}
                min={0}
                max={0.08}
                step={0.005}
                format={(v) => formatPercent(v)}
                parse={(v) => Number(v) / 100}
                onChange={(v) => onUpdate("rentInflation", v)}
              />
            </>
          ) : (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-3">
                {t("calc.btlRentalIncome")}
                <HelpTip
                  text={
                    isZh
                      ? "预期月租金、空置率和租金增长率"
                      : "Expected monthly rent, vacancy rate, and rent growth"
                  }
                />
              </h3>
              <ParamSlider
                label={t("calc.monthlyRentalIncome")}
                value={params.monthlyRent}
                min={5_000}
                max={150_000}
                step={1_000}
                format={(v) => formatHKD(v, true)}
                parse={(v) => Number(v) * (v.length <= 3 ? 1_000 : 1)}
                onChange={(v) => onUpdate("monthlyRent", v)}
              />
              <ParamSlider
                label={t("calc.vacancyRate")}
                value={params.vacancyRate}
                min={0}
                max={0.2}
                step={0.01}
                format={(v) => formatPercent(v, 0)}
                parse={(v) => Number(v) / 100}
                onChange={(v) => onUpdate("vacancyRate", v)}
              />
              <ParamSlider
                label={t("calc.rentGrowth")}
                value={params.rentInflation}
                min={0}
                max={0.08}
                step={0.005}
                format={(v) => formatPercent(v)}
                parse={(v) => Number(v) / 100}
                onChange={(v) => onUpdate("rentInflation", v)}
              />

              <div className="border-t border-stone-200/60 pt-4 mt-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-500 mb-3">
                {t("calc.ownerCosts")}
                <HelpTip
                  text={
                    isZh
                      ? "房东承担的物业管理费和政府差饷地租"
                      : "Landlord-borne management fees and government rates"
                  }
                />
              </h3>
              <ParamSlider
                label={t("calc.monthlyMgmtFee")}
                value={params.monthlyMgmtFee}
                min={0}
                max={15_000}
                step={500}
                format={(v) => formatHKD(v, true)}
                parse={(v) => Number(v)}
                onChange={(v) => onUpdate("monthlyMgmtFee", v)}
              />
              <ParamSlider
                label={t("calc.holdingExpenses")}
                value={params.holdingExpenseRate}
                min={0}
                max={0.008}
                step={0.001}
                format={(v) => formatPercent(v)}
                parse={(v) => Number(v) / 100}
                onChange={(v) => onUpdate("holdingExpenseRate", v)}
              />

              {(() => {
                const grossAnnual = params.monthlyRent * 12;
                const afterVacancy = grossAnnual * (1 - params.vacancyRate);
                const holdingAnnual = params.monthlyMgmtFee * 12 + params.propertyPrice * params.holdingExpenseRate;
                const netAnnual = afterVacancy - holdingAnnual;
                return (
                  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-amber-500">{t("btl.annualIncome")}</span>
                      <span className="text-xs font-mono font-semibold text-amber-600">{formatHKD(grossAnnual, true)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-amber-500">− {t("calc.vacancyRate")} ({formatPercent(params.vacancyRate, 0)})</span>
                      <span className="text-xs font-mono text-amber-500">−{formatHKD(grossAnnual * params.vacancyRate, true)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-rose-400">− {t("calc.monthlyHolding")}</span>
                      <span className="text-xs font-mono text-rose-400">−{formatHKD(holdingAnnual, true)}</span>
                    </div>
                    <div className="border-t border-amber-200/60 pt-1 flex justify-between items-center">
                      <span className="text-xs font-semibold text-amber-600">{t("calc.netRentalIncome")}</span>
                      <span className={`text-sm font-mono font-bold ${netAnnual >= 0 ? "text-red-600" : "text-green-700"}`}>
                        {formatHKD(netAnnual, true)}{t("btl.perYear")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-400">{t("calc.afterVacancyLabel")}</span>
                      <span className={`text-xs font-mono ${netAnnual >= 0 ? "text-red-500" : "text-green-600"}`}>
                        {formatHKD(netAnnual / 12, true)}/mo
                      </span>
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {mode === "owner-occupied" && (
            <>
              <div className="border-t border-stone-200/60 pt-4 mt-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-500 mb-3">
                {t("calc.ownerCosts")}
                <HelpTip
                  text={
                    isZh
                      ? "房东承担的物业管理费和政府差饷地租"
                      : "Landlord-borne management fees and government rates"
                  }
                />
              </h3>
              <ParamSlider
                label={t("calc.monthlyMgmtFee")}
                value={params.monthlyMgmtFee}
                min={0}
                max={15_000}
                step={500}
                format={(v) => formatHKD(v, true)}
                parse={(v) => Number(v)}
                onChange={(v) => onUpdate("monthlyMgmtFee", v)}
              />
              <ParamSlider
                label={t("calc.holdingExpenses")}
                value={params.holdingExpenseRate}
                min={0}
                max={0.008}
                step={0.001}
                format={(v) => formatPercent(v)}
                parse={(v) => Number(v) / 100}
                onChange={(v) => onUpdate("holdingExpenseRate", v)}
              />
            </>
          )}
          {mode === "buy-to-let" && (
            <>
              <div className="border-t border-stone-200/60 pt-4 mt-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                {t("calc.ownerCosts")}
                <HelpTip
                  text={
                    isZh
                      ? "房东承担的物业管理费和政府差饷地租"
                      : "Landlord-borne management fees and government rates"
                  }
                />
              </h3>
            </>
          )}
          <ParamSlider
            label={t("calc.agentCommission")}
            value={params.agentCommissionRate}
            min={0}
            max={0.03}
            step={0.005}
            format={(v) => formatPercent(v)}
            parse={(v) => Number(v) / 100}
            onChange={(v) => onUpdate("agentCommissionRate", v)}
          />
          <ParamSlider
            label={t("calc.sellingCost")}
            value={params.sellingCostRate}
            min={0}
            max={0.03}
            step={0.005}
            format={(v) => formatPercent(v)}
            parse={(v) => Number(v) / 100}
            onChange={(v) => onUpdate("sellingCostRate", v)}
          />
          <ParamSlider
            label={t("calc.renovationCost")}
            value={params.renovationCost}
            min={0}
            max={2_000_000}
            step={50_000}
            format={(v) => formatHKD(v, true)}
            parse={(v) => Number(v)}
            onChange={(v) => onUpdate("renovationCost", v)}
          />

          {mode === "owner-occupied" && (
            <div className="mt-2 rounded-lg bg-rose-50 border border-rose-100 px-3 py-2.5 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-rose-400">{t("calc.monthlyHolding")}</span>
                <span className="text-sm font-mono font-bold text-rose-700">{formatHKD(results.monthlyHolding, true)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-rose-400">{t("calc.mgmtAndRates")}</span>
                <span className="text-xs font-mono font-semibold text-rose-600">
                  {formatHKD(params.monthlyMgmtFee, true)} + {formatHKD(params.propertyPrice * params.holdingExpenseRate / 12, true)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-3">
            {t("calc.returnsProjection")}
            <HelpTip
              text={
                isZh
                  ? "机会成本 = 首付如不买房的投资回报；增值率 = 预期房价年涨幅"
                  : "Opportunity cost = return on capital if not buying; Appreciation = expected annual price growth"
              }
            />
          </h3>
          <ParamSlider
            label={t("calc.opportunityCost")}
            value={params.opportunityCostRate}
            min={0}
            max={0.15}
            step={0.001}
            format={(v) => formatPercent(v)}
            parse={(v) => Number(v) / 100}
            onChange={(v) => onUpdate("opportunityCostRate", v)}
          />
          <ParamSlider
            label={t("calc.appreciation")}
            value={params.appreciationRate}
            min={-0.05}
            max={0.1}
            step={0.001}
            format={(v) => formatPercent(v)}
            parse={(v) => Number(v) / 100}
            onChange={(v) => onUpdate("appreciationRate", v)}
          />
          <ParamSlider
            label={t("calc.projectionPeriod")}
            value={params.projectionYears}
            min={1}
            max={30}
            step={1}
            format={(v) => `${v}${yearsSuffix}`}
            parse={(v) => Number(v)}
            onChange={(v) => onUpdate("projectionYears", v)}
          />
          <ParamSlider
            label={t("calc.legalFee")}
            value={params.legalFee}
            min={0}
            max={100_000}
            step={5_000}
            format={(v) => formatHKD(v, true)}
            parse={(v) => Number(v)}
            onChange={(v) => onUpdate("legalFee", v)}
          />

          {/* Projected price readout */}
          {(() => {
            const futurePrice = params.propertyPrice * Math.pow(1 + params.appreciationRate, params.projectionYears);
            const totalGain = futurePrice - params.propertyPrice;
            const yearsLabel = locale !== "en"
              ? `${params.projectionYears}年${t("calc.afterYears")}`
              : `${t("calc.afterYears")} ${params.projectionYears} ${t("calc.years")}`;
            return (
              <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-indigo-400">{t("calc.projectedPrice")} ({yearsLabel})</span>
                  <span className="text-sm font-mono font-bold text-indigo-700">{formatHKD(futurePrice, true)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-indigo-400">{t("calc.totalAppreciation")}</span>
                  <span className={`text-xs font-mono font-semibold ${totalGain >= 0 ? "text-red-600" : "text-green-600"}`}>
                    {totalGain >= 0 ? "+" : ""}{formatHKD(totalGain, true)} ({formatPercent(futurePrice / params.propertyPrice - 1)})
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-stone-200/40 grid grid-cols-3 sm:grid-cols-7 gap-3">
        {[
          { label: t("calc.downPayment"), value: upfront.downPayment },
          { label: t("calc.stampDuty"), value: upfront.stampDuty },
          { label: t("calc.agentFee"), value: upfront.agentFee },
          { label: t("calc.legalFee"), value: upfront.legalFee },
          { label: t("calc.mip"), value: upfront.mortgageInsurance },
          { label: t("calc.renovation"), value: upfront.renovationCost },
          { label: t("calc.totalUpfront"), value: upfront.total },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider">
              {item.label}
            </p>
            <p className="text-base font-mono font-semibold text-zinc-700">
              {formatHKD(item.value, true)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
