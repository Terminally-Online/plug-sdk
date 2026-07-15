import { PortfolioHeaders, RecursiveStringMap } from "../schemas/address";
import { SeriesEntry } from "../schemas/series";

/**
 * A single portfolio valuation sample: unix seconds and USD value.
 */
export type PortfolioPoint = { time: number; value: number };

/**
 * Gusher's aggregate portfolio headers parsed into numbers. Each field is
 * null when the header was absent or unparseable. `netCarryApy` is in
 * percent units.
 */
export type PortfolioHeaderValues = {
  depositValue: number | null;
  debtValue: number | null;
  netWorth: number | null;
  netCarryApy: number | null;
  claimableValue: number | null;
};

const parseNumericText = (raw: string | undefined): number | null => {
  if (typeof raw !== "string" || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

/**
 * Parses gusher's aggregate portfolio headers (NUMERIC-as-TEXT strings) into
 * numbers. Returns null when no header carried a usable value.
 */
export const parsePortfolioHeaders = (
  headers: PortfolioHeaders | undefined,
): PortfolioHeaderValues | null => {
  if (!headers) return null;

  const values: PortfolioHeaderValues = {
    depositValue: parseNumericText(headers.deposit_value),
    debtValue: parseNumericText(headers.debt_value),
    netWorth: parseNumericText(headers.net_worth),
    netCarryApy: parseNumericText(headers.net_carry_apy),
    claimableValue: parseNumericText(headers.claimable_value),
  };

  const hasValue = Object.values(values).some((value) => value !== null);
  return hasValue ? values : null;
};

/**
 * Maps raw series entries to time-sorted portfolio points, dropping entries
 * without a parseable `portfolio.value`.
 */
export const toPortfolioPoints = (
  series: readonly SeriesEntry[] | undefined,
): PortfolioPoint[] => {
  if (!series || series.length === 0) return [];

  const points: PortfolioPoint[] = [];
  for (const entry of series) {
    const portfolio = entry.portfolio as RecursiveStringMap | undefined;
    const raw =
      typeof portfolio === "object" && portfolio !== null
        ? portfolio.value
        : undefined;
    if (typeof raw !== "string" || raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    points.push({ time: entry.timestamp, value });
  }

  points.sort((a, b) => a.time - b.time);
  return points;
};
