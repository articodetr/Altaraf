/**
 * Format number with thousands separator
 * - Shows no decimals for whole numbers (e.g., 8,000)
 * - Shows decimals only when present (e.g., 8,000.20)
 *
 * @param num - The number to format
 * @returns Formatted number string
 *
 * @example
 * formatNumber(8000) // "8,000"
 * formatNumber(8000.20) // "8,000.20"
 * formatNumber(1234567.89) // "1,234,567.89"
 */
export function formatNumber(num: number): string {
  // Check if number is whole (no decimal part)
  const isWholeNumber = num % 1 === 0;

  if (isWholeNumber) {
    // For whole numbers, format without decimals
    return Math.round(num).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  } else {
    // For decimal numbers, show exactly 2 decimals
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

/**
 * Format number with currency symbol
 *
 * @param num - The number to format
 * @param currency - Currency symbol or code
 * @returns Formatted string with amount and currency
 *
 * @example
 * formatNumberWithCurrency(8000, "USD") // "8,000 USD"
 * formatNumberWithCurrency(8000.20, "$") // "8,000.20 $"
 */
export function formatNumberWithCurrency(num: number, currency: string): string {
  return `${formatNumber(num)} ${currency}`;
}
