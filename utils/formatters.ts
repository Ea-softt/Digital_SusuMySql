/**
 * FORMATTERS.TS - Utility Functions for Formatting Data
 * Provides reusable formatting functions for currency, dates, phone numbers, etc.
 */

/**
 * Formats a number as currency with proper locale and symbol support
 * @param amount - The numeric amount to format
 * @param currency - The currency code (e.g., 'GHS', 'USD', 'NGN')
 * @param locale - Optional locale string (defaults to 'en-US')
 * @returns Formatted currency string
 * 
 * @example
 * moneyFormatter(1500, 'GHS') // "GHS 1,500.00"
 * moneyFormatter(1500.5, 'USD') // "$1,500.50"
 * moneyFormatter(1500, 'NGN') // "₦1,500.00"
 */
export const moneyFormatter = (
  amount: number | string,
  currency: string = 'GHS',
  locale: string = 'en-US'
): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Return 'N/A' if amount is invalid
  if (isNaN(numAmount)) {
    return 'N/A';
  }

  // Currency symbol mapping
  const currencySymbols: Record<string, string> = {
    GHS: '₵',
    USD: '$',
    EUR: '€',
    NGN: '₦',
    GBP: '£',
    INR: '₹',
  };

  // Format the number with thousand separators and 2 decimal places
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedNumber = formatter.format(numAmount);
  const symbol = currencySymbols[currency] || currency;

  return `${symbol} ${formattedNumber}`;
};

/**
 * Formats a number as a short currency display (without decimals, with K/M suffix)
 * Useful for dashboard cards and summaries
 * 
 * @example
 * moneyFormatterShort(1500, 'GHS') // "₵1.5K"
 * moneyFormatterShort(1500000, 'USD') // "$1.5M"
 * moneyFormatterShort(500, 'GHS') // "₵500"
 */
export const moneyFormatterShort = (
  amount: number | string,
  currency: string = 'GHS'
): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return 'N/A';
  }

  const currencySymbols: Record<string, string> = {
    GHS: '₵',
    USD: '$',
    EUR: '€',
    NGN: '₦',
    GBP: '£',
    INR: '₹',
  };

  const symbol = currencySymbols[currency] || currency;
  let shortValue: string;

  if (numAmount >= 1000000) {
    shortValue = (numAmount / 1000000).toFixed(1) + 'M';
  } else if (numAmount >= 1000) {
    shortValue = (numAmount / 1000).toFixed(1) + 'K';
  } else {
    shortValue = numAmount.toString();
  }

  return `${symbol}${shortValue}`;
};

/**
 * Formats a number as percentage
 * @example
 * percentFormatter(75.5) // "75.5%"
 * percentFormatter(75) // "75%"
 */
export const percentFormatter = (value: number | string, decimals: number = 0): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return 'N/A';
  }

  return `${numValue.toFixed(decimals)}%`;
};

/**
 * Formats a date string to a readable format
 * @example
 * dateFormatter('2024-05-15') // "May 15, 2024"
 * dateFormatter('2024-05-15', 'short') // "5/15/2024"
 */
export const dateFormatter = (dateString: string, format: 'long' | 'short' = 'long'): string => {
  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    if (format === 'short') {
      return date.toLocaleDateString('en-US');
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'Invalid Date';
  }
};

/**
 * Formats a phone number
 * @example
 * phoneFormatter('0246789012') // "024 678 9012"
 * phoneFormatter('0246789012', 'compact') // "024-678-9012"
 */
export const phoneFormatter = (phone: string, format: 'space' | 'dash' = 'space'): string => {
  if (!phone || phone.length < 10) {
    return phone || 'N/A';
  }

  const cleaned = phone.replace(/\D/g, '').slice(-10);
  const separator = format === 'dash' ? '-' : ' ';

  return `${cleaned.slice(0, 3)}${separator}${cleaned.slice(3, 6)}${separator}${cleaned.slice(6)}`;
};

/**
 * Validates if a string is a valid currency amount
 * @example
 * isValidAmount('100.50') // true
 * isValidAmount('abc') // false
 * isValidAmount('100') // true
 */
export const isValidAmount = (value: string | number): boolean => {
  if (typeof value === 'number') {
    return !isNaN(value) && value >= 0;
  }

  const parsed = parseFloat(value);
  return !isNaN(parsed) && parsed >= 0 && value.trim() !== '';
};

/**
 * Validates if two amounts are equal (accounting for floating point precision)
 */
export const isAmountEqual = (amount1: number, amount2: number, tolerance: number = 0.01): boolean => {
  return Math.abs(amount1 - amount2) < tolerance;
};
