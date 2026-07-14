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
