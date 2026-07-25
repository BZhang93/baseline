// Client-safe (no DB import): supported currencies for the player's budget.
export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "CHF",
  "JPY",
  "CNY",
  "SEK",
  "NZD",
] as const;

export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

// Static approximate rates to USD (prototype — swap for a live FX feed later,
// same as the tournament data). Used to keep net-of-cost math in one currency
// even when event prize money is listed in EUR/etc. (player-feedback P2-13).
const RATE_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  AUD: 0.66,
  CAD: 0.73,
  CHF: 1.12,
  JPY: 0.0067,
  CNY: 0.14,
  SEK: 0.096,
  NZD: 0.61,
};

// Convert an amount in `currency` to USD (unknown currencies pass through as-is).
export function toUsd(amount: number, currency: string): number {
  return amount * (RATE_TO_USD[currency] ?? 1);
}

// Convert between any two supported currencies (via USD).
export function convert(amount: number, from: string, to: string): number {
  return toUsd(amount, from) / (RATE_TO_USD[to] ?? 1);
}
