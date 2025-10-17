// Shared money helpers to ensure consistent two-decimal rounding everywhere

/** Convert a dollar number to integer cents with proper rounding. */
export function toCents(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

/** Ensure a numeric value is a safe integer cents value. */
export function normalizeCents(cents) {
  const num = Number(cents);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num);
}

/** Convert integer cents to a dollar number (floating) for calculations. */
export function fromCents(cents) {
  return normalizeCents(cents) / 100;
}

/** Format integer cents as a 2-decimal string, without currency symbol. */
export function formatCents(cents) {
  return fromCents(cents).toFixed(2);
}

/** Format integer cents with a currency symbol (default '$'). */
export function formatMoney(cents, symbol = '$') {
  const value = formatCents(cents);
  return `${symbol}${value}`;
}
