"use client";

import { useState, useMemo, useCallback } from "react";
import { CalcParams, DEFAULT_PARAMS, AnalysisMode } from "@/lib/constants";
import {
  calcSingleYear,
  calcUpfrontCosts,
  calcMultiYearProjection,
  calcMonthlyPayment,
  calcBreakevenAppreciation,
  calcSensitivityGrid,
  calcAnnualHolding,
  calcBTLSingleYear,
  calcBTLProjection,
  SingleYearResult,
  YearProjection,
  SensitivityCell,
  BTLSingleYear,
  BTLYearProjection,
} from "@/lib/calculator";

export interface CalcResults {
  mode: AnalysisMode;
  params: CalcParams;
  upfront: ReturnType<typeof calcUpfrontCosts>;
  monthlyPayment: number;
  monthlyHolding: number;
  loanAmount: number;
  singleYear: SingleYearResult;
  averageAnnualTco: number;
  averageAnnualTcr: number;
  projection: YearProjection[];
  breakevenG: number;
  sensitivityGrid: SensitivityCell[];
  btl: BTLSingleYear;
  btlProjection: BTLYearProjection[];
}

export function usePropertyCalc() {
  const [params, setParams] = useState<CalcParams>(DEFAULT_PARAMS);
  const [mode, setMode] = useState<AnalysisMode>("owner-occupied");

  const updateParam = useCallback(
    <K extends keyof CalcParams>(key: K, value: CalcParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetParams = useCallback(() => {
    setParams(DEFAULT_PARAMS);
  }, []);

  const results: CalcResults = useMemo(() => {
    const loanAmount = params.propertyPrice * params.ltvRatio;
    const upfront = calcUpfrontCosts(params);
    const monthlyPayment = calcMonthlyPayment(
      loanAmount,
      params.mortgageRate,
      params.loanTermYears
    );
    const singleYear = calcSingleYear(params);
    const projection = calcMultiYearProjection(params);
    const breakevenG = calcBreakevenAppreciation(params);
    const monthlyHolding = calcAnnualHolding(params) / 12;

    const n = projection.length;
    const averageAnnualTco = n > 0 ? projection[n - 1].tcoCumulative / n : singleYear.tco;
    const averageAnnualTcr = n > 0 ? projection[n - 1].tcrCumulative / n : singleYear.tcr;

    const riValues = Array.from({ length: 11 }, (_, i) => i * 0.01);
    const gValues = Array.from({ length: 11 }, (_, i) => -0.02 + i * 0.01);
    const sensitivityGrid = calcSensitivityGrid(params, riValues, gValues);

    const btl = calcBTLSingleYear(params);
    const btlProjection = calcBTLProjection(params);

    return {
      mode,
      params,
      upfront,
      monthlyPayment,
      monthlyHolding,
      loanAmount,
      singleYear,
      averageAnnualTco,
      averageAnnualTcr,
      projection,
      breakevenG,
      sensitivityGrid,
      btl,
      btlProjection,
    };
  }, [params, mode]);

  const applyEstimatorResults = useCallback(
    (propertyPrice: number, monthlyRent: number) => {
      setParams((prev) => ({ ...prev, propertyPrice, monthlyRent }));
    },
    []
  );

  return { params, mode, setMode, updateParam, resetParams, applyEstimatorResults, results };
}
