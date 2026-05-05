export type Currency = 'USD' | 'GBP' | 'INR';

// Meta spends come in INR (base). These are indicative display-only rates.
// Given: 1 USD = 95 INR.
// Using our previous GBP ratio vs USD: 1 USD ≈ 0.79 GBP.
const INR_PER_USD = 95;
const GBP_PER_USD = 0.79;

const RATES_FROM_INR: Record<Currency, number> = {
  INR: 1,
  USD: 1 / INR_PER_USD,
  GBP: (1 / INR_PER_USD) * GBP_PER_USD,
};

const SYMBOLS: Record<Currency, string> = {
  USD: '$',
  GBP: '£',
  INR: '₹',
};

export function convertFromUsd(usd: number, currency: Currency): number {
  // Backwards-compat: treat input as INR base now.
  return convertFromInr(usd, currency);
}

export function convertFromInr(inr: number, currency: Currency): number {
  return inr * RATES_FROM_INR[currency];
}

export function convertToInr(displayValue: number, currency: Currency): number {
  const rate = RATES_FROM_INR[currency];
  return rate > 0 ? displayValue / rate : displayValue;
}

export function fmtCurrency(inr: number, currency: Currency): string {
  const value = convertFromInr(inr, currency);
  const sym = SYMBOLS[currency];
  return `${sym}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const CURRENCIES: { value: Currency; label: string; sym: string }[] = [
  { value: 'USD', label: 'USD', sym: '$' },
  { value: 'GBP', label: 'GBP', sym: '£' },
  { value: 'INR', label: 'INR', sym: '₹' },
];
