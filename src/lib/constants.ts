export const STAMP_DUTY_SCALE_2 = [
  { threshold: 3_000_000, rate: 0, fixed: 100 },
  { threshold: 3_528_240, rate: 0.10, base: 3_000_001 },
  { threshold: 4_500_000, rate: 0.015, fixed: 0 },
  { threshold: 4_935_480, rate: 0.10, base: 4_500_001 },
  { threshold: 6_000_000, rate: 0.0225, fixed: 0 },
  { threshold: 6_642_860, rate: 0.10, base: 6_000_001 },
  { threshold: 9_000_000, rate: 0.03, fixed: 0 },
  { threshold: 10_080_000, rate: 0.10, base: 9_000_001 },
  { threshold: 20_000_000, rate: 0.0375, fixed: 0 },
  { threshold: 21_739_120, rate: 0.10, base: 20_000_001 },
  { threshold: Infinity, rate: 0.0425, fixed: 0 },
];

export const STAMP_DUTY_BRACKETS = [
  { min: 0, max: 3_000_000, rate: "HK$100" },
  { min: 3_000_001, max: 4_500_000, rate: "1.5%" },
  { min: 4_500_001, max: 6_000_000, rate: "2.25%" },
  { min: 6_000_001, max: 9_000_000, rate: "3.0%" },
  { min: 9_000_001, max: 20_000_000, rate: "3.75%" },
  { min: 20_000_001, max: Infinity, rate: "4.25%" },
];

export type AnalysisMode = "owner-occupied" | "buy-to-let";

export interface CalcParams {
  propertyPrice: number;
  ltvRatio: number;
  mortgageRate: number;
  loanTermYears: number;
  monthlyRent: number;
  monthlyMgmtFee: number;
  holdingExpenseRate: number;
  opportunityCostRate: number;
  appreciationRate: number;
  agentCommissionRate: number;
  legalFee: number;
  rentInflation: number;
  projectionYears: number;
  mortgageInsurancePct: number;
  renovationCost: number;
  sellingCostRate: number;
  vacancyRate: number;
}

export const DEFAULT_PARAMS: CalcParams = {
  propertyPrice: 15_000_000,
  ltvRatio: 0.6,
  mortgageRate: 0.0325,
  loanTermYears: 25,
  monthlyRent: 38_000,
  monthlyMgmtFee: 3_500,
  holdingExpenseRate: 0.002,
  opportunityCostRate: 0.03,
  appreciationRate: 0,
  agentCommissionRate: 0.01,
  legalFee: 10_000,
  rentInflation: 0.02,
  projectionYears: 20,
  mortgageInsurancePct: 0,
  renovationCost: 0,
  sellingCostRate: 0.01,
  vacancyRate: 0.05,
};

export const PARAM_RANGES: Record<
  keyof CalcParams,
  { min: number; max: number; step: number }
> = {
  propertyPrice: { min: 2_000_000, max: 50_000_000, step: 100_000 },
  ltvRatio: { min: 0.1, max: 0.9, step: 0.05 },
  mortgageRate: { min: 0.01, max: 0.08, step: 0.0005 },
  loanTermYears: { min: 5, max: 30, step: 1 },
  monthlyRent: { min: 5_000, max: 150_000, step: 1_000 },
  monthlyMgmtFee: { min: 0, max: 15_000, step: 500 },
  holdingExpenseRate: { min: 0, max: 0.008, step: 0.001 },
  opportunityCostRate: { min: 0, max: 0.15, step: 0.001 },
  appreciationRate: { min: -0.05, max: 0.1, step: 0.001 },
  agentCommissionRate: { min: 0, max: 0.02, step: 0.0025 },
  legalFee: { min: 0, max: 100_000, step: 5_000 },
  rentInflation: { min: 0, max: 0.08, step: 0.005 },
  projectionYears: { min: 1, max: 30, step: 1 },
  mortgageInsurancePct: { min: 0, max: 0.05, step: 0.005 },
  renovationCost: { min: 0, max: 2_000_000, step: 50_000 },
  sellingCostRate: { min: 0, max: 0.03, step: 0.005 },
  vacancyRate: { min: 0, max: 0.2, step: 0.01 },
};
