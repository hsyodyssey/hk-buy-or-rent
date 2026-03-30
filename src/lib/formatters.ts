export function formatHKD(value: number, compact = false): string {
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) {
      return `HK$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (abs >= 1_000) {
      return `HK$${(value / 1_000).toFixed(0)}K`;
    }
    return `HK$${value.toFixed(0)}`;
  }
  return `HK$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatCompactHKD(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}HK$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}HK$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}HK$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}HK$${abs.toFixed(0)}`;
}
