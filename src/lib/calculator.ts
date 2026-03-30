import { CalcParams } from "./constants";

export function calcStampDuty(price: number): number {
  if (price <= 3_000_000) return 100;
  if (price <= 4_500_000) return price * 0.015;
  if (price <= 6_000_000) return price * 0.0225;
  if (price <= 9_000_000) return price * 0.03;
  if (price <= 20_000_000) return price * 0.0375;
  return price * 0.0425;
}

export function calcUpfrontCosts(params: CalcParams) {
  const loan = params.propertyPrice * params.ltvRatio;
  const downPayment = params.propertyPrice - loan;
  const stampDuty = calcStampDuty(params.propertyPrice);
  const agentFee = params.propertyPrice * params.agentCommissionRate;
  const legalFee = params.legalFee;
  const mortgageInsurance = loan * params.mortgageInsurancePct;
  const renovationCost = params.renovationCost;
  const transactionCosts = stampDuty + agentFee + legalFee + mortgageInsurance + renovationCost;
  return {
    downPayment,
    stampDuty,
    agentFee,
    legalFee,
    mortgageInsurance,
    renovationCost,
    transactionCosts,
    total: downPayment + transactionCosts,
  };
}

export function calcAnnualHolding(params: CalcParams): number {
  return params.monthlyMgmtFee * 12 + params.propertyPrice * params.holdingExpenseRate;
}

export function calcMonthlyPayment(
  loan: number,
  annualRate: number,
  years: number
): number {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return loan / n;
  return (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export interface AmortizationYear {
  year: number;
  startBalance: number;
  totalPayment: number;
  principalPaid: number;
  interestPaid: number;
  endBalance: number;
}

export function calcAmortizationSchedule(
  loan: number,
  annualRate: number,
  years: number
): AmortizationYear[] {
  const monthlyPmt = calcMonthlyPayment(loan, annualRate, years);
  const r = annualRate / 12;
  const schedule: AmortizationYear[] = [];
  let balance = loan;

  for (let y = 1; y <= years; y++) {
    const startBalance = balance;
    let yearInterest = 0;
    let yearPrincipal = 0;

    for (let m = 0; m < 12; m++) {
      const interest = balance * r;
      const principal = monthlyPmt - interest;
      yearInterest += interest;
      yearPrincipal += principal;
      balance -= principal;
    }

    schedule.push({
      year: y,
      startBalance,
      totalPayment: monthlyPmt * 12,
      principalPaid: yearPrincipal,
      interestPaid: yearInterest,
      endBalance: Math.max(0, balance),
    });
  }

  return schedule;
}

// ── Annualized average helpers ──────────────────────────────────
// Geometric series average: sum((1+r)^0 .. (1+r)^(N-1)) / N
function geoSeriesAvgFactor(rate: number, n: number): number {
  if (n <= 0) return 0;
  if (Math.abs(rate) < 1e-12) return 1;
  return (Math.pow(1 + rate, n) - 1) / (rate * n);
}

export interface SingleYearResult {
  interestCost: number;
  holdingExpenses: number;
  opportunityCost: number;
  appreciation: number;
  buyingCostAmortized: number;
  sellingCostAmortized: number;
  tco: number;
  tcr: number;
  difference: number;
}

/**
 * Computes ANNUALIZED AVERAGE costs over the projection period.
 * All components are averaged to be consistent with multi-year projection.
 */
export function calcSingleYear(params: CalcParams): SingleYearResult {
  const N = Math.max(params.projectionYears, 1);
  const loan = params.propertyPrice * params.ltvRatio;
  const upfront = calcUpfrontCosts(params);

  // Average annual interest: total interest over min(loanTerm, N) / N
  const effectiveLoanYears = Math.min(params.loanTermYears, N);
  const monthlyPmt = calcMonthlyPayment(loan, params.mortgageRate, params.loanTermYears);
  const totalPaymentsInPeriod = monthlyPmt * 12 * effectiveLoanYears;
  const loanPaidOff = effectiveLoanYears >= params.loanTermYears;
  const principalRepaid = loanPaidOff ? loan : (() => {
    const schedule = calcAmortizationSchedule(loan, params.mortgageRate, params.loanTermYears);
    return schedule.slice(0, effectiveLoanYears).reduce((s, y) => s + y.principalPaid, 0);
  })();
  const totalInterestInPeriod = totalPaymentsInPeriod - principalRepaid;
  const interestCost = totalInterestInPeriod / N;

  const holdingExpenses = calcAnnualHolding(params);

  // Average annual opportunity cost: C compounds at ri, charge ri each year
  // Sum = C × ((1+ri)^N - 1), Average = C × ((1+ri)^N - 1) / N
  const ri = params.opportunityCostRate;
  const opportunityCost = N > 0
    ? upfront.total * (Math.pow(1 + ri, N) - 1) / N
    : 0;

  // Average annual appreciation: P × ((1+g)^N - 1) / N
  const g = params.appreciationRate;
  const appreciation = N > 0
    ? params.propertyPrice * (Math.pow(1 + g, N) - 1) / N
    : 0;

  // Amortized one-time costs
  const buyingCostAmortized = upfront.transactionCosts / N;
  const futurePrice = params.propertyPrice * Math.pow(1 + g, N);
  const sellingCostAmortized = (futurePrice * params.sellingCostRate) / N;

  const tco =
    interestCost + holdingExpenses + opportunityCost +
    buyingCostAmortized + sellingCostAmortized - appreciation;

  // Average annual rent (with inflation)
  const tcr = params.monthlyRent * 12 * geoSeriesAvgFactor(params.rentInflation, N);

  return {
    interestCost,
    holdingExpenses,
    opportunityCost,
    appreciation,
    buyingCostAmortized,
    sellingCostAmortized,
    tco,
    tcr,
    difference: tco - tcr,
  };
}

export interface YearProjection {
  year: number;
  interestCost: number;
  holdingExpenses: number;
  opportunityCost: number;
  appreciation: number;
  buyingCostAmortized: number;
  sellingCostAmortized: number;
  tcoAnnual: number;
  tcoCumulative: number;
  propertyValue: number;
  loanBalance: number;
  ownerEquity: number;
  rent: number;
  tcrAnnual: number;
  tcrCumulative: number;
  renterPortfolio: number;
  ownerInvestments: number;
  annualDiff: number;
  cumulativeDiff: number;
  ownerNetWealth: number;
  renterNetWealth: number;
}

export function calcMultiYearProjection(
  params: CalcParams
): YearProjection[] {
  const loan = params.propertyPrice * params.ltvRatio;
  const upfront = calcUpfrontCosts(params);
  const amortization = calcAmortizationSchedule(
    loan,
    params.mortgageRate,
    params.loanTermYears
  );
  const monthlyPmt = calcMonthlyPayment(
    loan,
    params.mortgageRate,
    params.loanTermYears
  );

  const projections: YearProjection[] = [];
  let tcoCumulative = 0;
  let tcrCumulative = 0;
  let renterPortfolio = upfront.total;
  let ownerInvestments = 0;
  let hypotheticalCapital = upfront.total;

  const N = Math.max(params.projectionYears, 1);
  const buyingCostAmortized = upfront.transactionCosts / N;
  const futurePrice =
    params.propertyPrice * Math.pow(1 + params.appreciationRate, N);
  const sellingCostAmortized = (futurePrice * params.sellingCostRate) / N;

  for (let y = 1; y <= params.projectionYears; y++) {
    const propertyValue =
      params.propertyPrice * Math.pow(1 + params.appreciationRate, y);
    const prevPropertyValue =
      params.propertyPrice * Math.pow(1 + params.appreciationRate, y - 1);
    const appreciation = propertyValue - prevPropertyValue;

    const amortYear = y <= amortization.length ? amortization[y - 1] : null;
    const interestCost = amortYear ? amortYear.interestPaid : 0;
    const loanBalance = amortYear ? amortYear.endBalance : 0;

    const holdingExpenses = calcAnnualHolding(params);
    const opportunityCost = hypotheticalCapital * params.opportunityCostRate;

    const tcoAnnual =
      interestCost + holdingExpenses + opportunityCost +
      buyingCostAmortized + sellingCostAmortized - appreciation;
    tcoCumulative += tcoAnnual;

    const rent =
      params.monthlyRent * 12 * Math.pow(1 + params.rentInflation, y - 1);
    const tcrAnnual = rent;
    tcrCumulative += tcrAnnual;

    renterPortfolio *= 1 + params.opportunityCostRate;
    ownerInvestments *= 1 + params.opportunityCostRate;
    hypotheticalCapital *= 1 + params.opportunityCostRate;

    const annualMortgagePayment = monthlyPmt * 12;
    const cashFlowDiff = annualMortgagePayment + holdingExpenses - rent;
    if (cashFlowDiff > 0) {
      renterPortfolio += cashFlowDiff;
    } else {
      ownerInvestments += -cashFlowDiff;
    }

    const sellingCost = propertyValue * params.sellingCostRate;
    const ownerEquity = propertyValue - loanBalance;
    const ownerNetWealth = ownerEquity - sellingCost + ownerInvestments;
    const renterNetWealth = renterPortfolio;

    projections.push({
      year: y,
      interestCost,
      holdingExpenses,
      opportunityCost,
      appreciation,
      buyingCostAmortized,
      sellingCostAmortized,
      tcoAnnual,
      tcoCumulative,
      propertyValue,
      loanBalance,
      ownerEquity,
      rent,
      tcrAnnual,
      tcrCumulative,
      renterPortfolio,
      ownerInvestments,
      annualDiff: tcoAnnual - tcrAnnual,
      cumulativeDiff: tcoCumulative - tcrCumulative,
      ownerNetWealth,
      renterNetWealth,
    });
  }

  return projections;
}

export interface SensitivityCell {
  ri: number;
  g: number;
  annualDiff: number;
}

export function calcSensitivityGrid(
  params: CalcParams,
  riRange: number[],
  gRange: number[]
): SensitivityCell[] {
  const cells: SensitivityCell[] = [];
  for (const ri of riRange) {
    for (const g of gRange) {
      const modified = {
        ...params,
        opportunityCostRate: ri,
        appreciationRate: g,
      };
      const result = calcSingleYear(modified);
      cells.push({ ri, g, annualDiff: result.difference });
    }
  }
  return cells;
}

// ── Buy-to-Let (BTL) calculations ─────────────────────────────

export interface BTLSingleYear {
  rentalIncome: number;
  mortgagePayment: number;
  interestCost: number;
  holdingExpenses: number;
  buyingCostAmortized: number;
  sellingCostAmortized: number;
  totalCost: number;
  appreciation: number;
  annualCashFlow: number;
  monthlyCashFlow: number;
  grossYield: number;
  netYield: number;
  cashOnCash: number;
  totalAnnualReturn: number;
  alternativeReturn: number;
}

export function calcBTLSingleYear(params: CalcParams): BTLSingleYear {
  const N = Math.max(params.projectionYears, 1);
  const loan = params.propertyPrice * params.ltvRatio;
  const upfront = calcUpfrontCosts(params);

  const effectiveRent = params.monthlyRent * 12 * (1 - params.vacancyRate);
  const rentalIncome = effectiveRent * geoSeriesAvgFactor(params.rentInflation, N);

  const monthlyPmt = calcMonthlyPayment(loan, params.mortgageRate, params.loanTermYears);
  const mortgagePayment = monthlyPmt * 12;

  const effectiveLoanYears = Math.min(params.loanTermYears, N);
  const totalPaymentsInPeriod = monthlyPmt * 12 * effectiveLoanYears;
  const loanPaidOff = effectiveLoanYears >= params.loanTermYears;
  const principalRepaid = loanPaidOff ? loan : (() => {
    const schedule = calcAmortizationSchedule(loan, params.mortgageRate, params.loanTermYears);
    return schedule.slice(0, effectiveLoanYears).reduce((s, y) => s + y.principalPaid, 0);
  })();
  const interestCost = (totalPaymentsInPeriod - principalRepaid) / N;

  const holdingExpenses = calcAnnualHolding(params);

  const g = params.appreciationRate;
  const futurePrice = params.propertyPrice * Math.pow(1 + g, N);
  const buyingCostAmortized = upfront.transactionCosts / N;
  const sellingCostAmortized = (futurePrice * params.sellingCostRate) / N;
  const appreciation = N > 0
    ? params.propertyPrice * (Math.pow(1 + g, N) - 1) / N
    : 0;

  const totalCost = interestCost + holdingExpenses + buyingCostAmortized + sellingCostAmortized;

  const avgMortgagePayment = effectiveLoanYears < N
    ? (mortgagePayment * effectiveLoanYears) / N
    : mortgagePayment;
  const annualCashFlow = rentalIncome - avgMortgagePayment - holdingExpenses;
  const monthlyCashFlow = annualCashFlow / 12;

  const grossYield = (params.monthlyRent * 12) / params.propertyPrice;
  const netYield = (effectiveRent - holdingExpenses) / params.propertyPrice;
  const cashOnCash = upfront.total > 0 ? annualCashFlow / upfront.total : 0;

  const avgPrincipalRepaid = principalRepaid / N;
  const totalAnnualReturn = annualCashFlow + appreciation + avgPrincipalRepaid;

  const ri = params.opportunityCostRate;
  const alternativeReturn = upfront.total > 0
    ? upfront.total * (Math.pow(1 + ri, N) - 1) / N
    : 0;

  return {
    rentalIncome,
    mortgagePayment: avgMortgagePayment,
    interestCost,
    holdingExpenses,
    buyingCostAmortized,
    sellingCostAmortized,
    totalCost,
    appreciation,
    annualCashFlow,
    monthlyCashFlow,
    grossYield,
    netYield,
    cashOnCash,
    totalAnnualReturn,
    alternativeReturn,
  };
}

export interface BTLYearProjection {
  year: number;
  rentalIncome: number;
  mortgagePayment: number;
  holdingExpenses: number;
  cashFlow: number;
  cumulativeCashFlow: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
  investorWealth: number;
  alternativeWealth: number;
  grossYield: number;
  netYield: number;
}

export function calcBTLProjection(params: CalcParams): BTLYearProjection[] {
  const loan = params.propertyPrice * params.ltvRatio;
  const upfront = calcUpfrontCosts(params);
  const amortization = calcAmortizationSchedule(loan, params.mortgageRate, params.loanTermYears);
  const monthlyPmt = calcMonthlyPayment(loan, params.mortgageRate, params.loanTermYears);
  const ri = params.opportunityCostRate;

  const projections: BTLYearProjection[] = [];
  let cumulativeCashFlow = 0;

  // Investor's liquid assets from property surplus (never negative).
  // Negative CF = out-of-pocket payment → credited to alternative instead.
  let investorLiquid = 0;

  // Alternative investor: keeps upfront capital, plus invests any shortfalls
  // the property investor would have paid from salary.
  let alternativeWealth = upfront.total;

  for (let y = 1; y <= params.projectionYears; y++) {
    const effectiveRent =
      params.monthlyRent * 12 * (1 - params.vacancyRate) *
      Math.pow(1 + params.rentInflation, y - 1);

    const mortgagePayment = y <= amortization.length ? monthlyPmt * 12 : 0;
    const holdingExpenses = calcAnnualHolding(params);
    const cashFlow = effectiveRent - mortgagePayment - holdingExpenses;
    cumulativeCashFlow += cashFlow;

    // Compound existing assets (investorLiquid is always >= 0)
    investorLiquid *= (1 + ri);
    alternativeWealth *= (1 + ri);

    if (cashFlow >= 0) {
      // Surplus: investor saves and invests it
      investorLiquid += cashFlow;
    } else {
      // Shortfall: use existing liquid surplus first, then pay from pocket
      const coveredFromLiquid = Math.min(investorLiquid, -cashFlow);
      investorLiquid -= coveredFromLiquid;
      const fromPocket = -cashFlow - coveredFromLiquid;
      // Alternative investor gets to invest the pocket money instead
      alternativeWealth += fromPocket;
    }

    const propertyValue = params.propertyPrice * Math.pow(1 + params.appreciationRate, y);
    const amortYear = y <= amortization.length ? amortization[y - 1] : null;
    const loanBalance = amortYear ? amortYear.endBalance : 0;
    const equity = propertyValue - loanBalance;
    const sellingCost = propertyValue * params.sellingCostRate;

    const investorWealth = equity - sellingCost + investorLiquid;

    const grossYield = (params.monthlyRent * 12 * Math.pow(1 + params.rentInflation, y - 1)) / propertyValue;
    const netYield = (effectiveRent - holdingExpenses) / propertyValue;

    projections.push({
      year: y,
      rentalIncome: effectiveRent,
      mortgagePayment,
      holdingExpenses,
      cashFlow,
      cumulativeCashFlow,
      propertyValue,
      loanBalance,
      equity,
      investorWealth,
      alternativeWealth,
      grossYield,
      netYield,
    });
  }

  return projections;
}

export function calcBreakevenAppreciation(params: CalcParams): number {
  let lo = -0.1;
  let hi = 0.2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const result = calcSingleYear({ ...params, appreciationRate: mid });
    if (result.difference > 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}
