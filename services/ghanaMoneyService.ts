/**
 * GHANA MOBILE MONEY SERVICE
 * Handles wallet loading via MTN, Vodafone, and AirtelTigo in Ghana
 */

export type MobileMoneyProvider = 'MTN' | 'Vodafone' | 'AirtelTigo' | 'Telecel' | 'AT';

export interface MobileMoneyPayment {
  provider: MobileMoneyProvider;
  phoneNumber: string;
  amount: number;
  currency: string;
  transactionId: string;
  timestamp: string;
}

export interface MobileMoneyResponse {
  success: boolean;
  message: string;
  transactionId?: string;
  error?: string;
}

/**
 * Ghana Mobile Money Provider Configuration
 */
const PROVIDERS = {
  MTN: {
    name: 'MTN Mobile Money',
    ussdCode: '*170#',
    shortCode: '170',
    description: 'MTN Money Transfer Service',
  },
  Telecel: {
    name: 'Telecel Cash',
    ussdCode: '*110#',
    shortCode: '110',
    description: 'Telecel Cash Service',
    aliases: ['Vodafone'],
  },
  AT: {
    name: 'AT Money',
    ussdCode: '*110#',
    shortCode: '110',
    description: 'AT Money Service',
    aliases: ['AirtelTigo'],
  },
  Vodafone: { // Kept for backward compatibility
    name: 'Vodafone Cash',
    ussdCode: '*110#',
    shortCode: '110',
    description: 'Vodafone Cash Service',
  },
  AirtelTigo: { // Kept for backward compatibility
    name: 'AirtelTigo Money',
    ussdCode: '*110#',
    shortCode: '110',
    description: 'AirtelTigo Money Service',
  },
};

/**
 * Validates a Ghanaian phone number
 * Accepts formats: 024XXXXXXX, 0246789012, +233246789012, 233246789012
 * 
 * @example
 * isValidGhanaianPhone('0246789012') // true
 * isValidGhanaianPhone('024 678 9012') // true
 * isValidGhanaianPhone('+233246789012') // true
 * isValidGhanaianPhone('123456') // false
 */
export const isValidGhanaianPhone = (phoneNumber: string): boolean => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return false;
  }

  // Remove all non-digit characters except leading +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // Check various formats
  // 0246789012 (starts with 0)
  const formatWithZero = /^0[2-9]\d{8}$/.test(cleaned.replace('+', ''));
  
  // +233246789012 (international format)
  const internationalFormat = /^\+233[2-9]\d{8}$/.test(cleaned);
  
  // 233246789012 (country code without +)
  const countryCodeFormat = /^233[2-9]\d{8}$/.test(cleaned);

  return formatWithZero || internationalFormat || countryCodeFormat;
};

/**
 * Normalizes a phone number to a standard format (024XXXXXXX)
 * 
 * @example
 * normalizePhoneNumber('0246789012') // '024 678 9012'
 * normalizePhoneNumber('+233246789012') // '024 678 9012'
 */
export const normalizePhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return '';

  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');

  // Convert to 0-prefix format
  let normalized = digits;
  
  if (digits.startsWith('233')) {
    // Remove 233 country code and add 0
    normalized = '0' + digits.slice(3);
  } else if (!digits.startsWith('0')) {
    // Add 0 if missing
    normalized = '0' + digits;
  }

  // Format as 024 678 9012
  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
  }

  return normalized;
};

/**
 * Formats phone number for internal storage (no spaces or special chars)
 */
export const formatPhoneForStorage = (phoneNumber: string): string => {
  return phoneNumber.replace(/\s+/g, '');
};

/**
 * Gets the mobile money provider for a phone number
 * Ghanaian network prefixes:
 * - 024, 025, 026 = MTN
 * - 027, 028 = Vodafone
 * - 020, 023 = AirtelTigo
 */
export const getProviderFromPhone = (phoneNumber: string): MobileMoneyProvider | null => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  const prefix = cleaned.slice(-10, -8); // Get the 2nd and 3rd digits

  if (['024', '025', '026'].some(p => cleaned.includes(p))) {
    return 'MTN';
  }
  if (['027', '028'].some(p => cleaned.includes(p))) {
    return 'Vodafone';
  }
  if (['020', '023'].some(p => cleaned.includes(p))) {
    return 'AirtelTigo';
  }

  return null;
};

/**
 * Simulates Ghana Mobile Money Payment Processing
 * In production, this would integrate with actual payment APIs
 * (Hubtel, Flutterwave, Paystack, etc.)
 */
export const processGhanaMobileMoneyPayment = async (
  provider: MobileMoneyProvider,
  phoneNumber: string,
  amount: number,
  currency: string = 'GHS'
): Promise<MobileMoneyResponse> => {
  // Validate inputs
  if (!isValidGhanaianPhone(phoneNumber)) {
    return {
      success: false,
      message: 'Invalid Ghanaian phone number',
      error: 'Please enter a valid phone number (024XXXXXXX)',
    };
  }

  if (amount <= 0) {
    return {
      success: false,
      message: 'Invalid amount',
      error: 'Amount must be greater than 0',
    };
  }

  if (amount < 1) {
    return {
      success: false,
      message: 'Minimum amount is GHS 1.00',
      error: 'Amount is too small',
    };
  }

  if (amount > 10000) {
    return {
      success: false,
      message: 'Maximum amount is GHS 10,000 per transaction',
      error: 'Amount exceeds daily limit',
    };
  }

  // Check if provider is valid
  if (!PROVIDERS[provider]) {
    return {
      success: false,
      message: 'Invalid mobile money provider',
      error: `${provider} is not supported`,
    };
  }

  try {
    // Generate transaction ID
    const transactionId = `MM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Normalize phone number
    const normalizedPhone = formatPhoneForStorage(phoneNumber);

    // In production, call actual payment gateway here
    // Example APIs: Hubtel, Flutterwave, Paystack, MTN MoMo
    const payment: MobileMoneyPayment = {
      provider,
      phoneNumber: normalizedPhone,
      amount,
      currency,
      transactionId,
      timestamp: new Date().toISOString(),
    };

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulated success response
    // In production, check actual payment gateway response
    return {
      success: true,
      message: `Payment of ${currency} ${amount} initiated via ${PROVIDERS[provider].name}. You will receive a USSD prompt on ${normalizePhoneNumber(phoneNumber)}.`,
      transactionId,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Payment processing failed',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Validates transaction before processing
 */
export const validateMobileMoneyTransaction = (
  provider: MobileMoneyProvider,
  phoneNumber: string,
  amount: number
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!phoneNumber) {
    errors.push('Phone number is required');
  } else if (!isValidGhanaianPhone(phoneNumber)) {
    errors.push('Invalid Ghanaian phone number (use format: 024XXXXXXX)');
  }

  if (!provider) {
    errors.push('Mobile money provider is required');
  } else if (!PROVIDERS[provider]) {
    errors.push(`Invalid provider: ${provider}`);
  }

  if (!amount) {
    errors.push('Amount is required');
  } else if (amount <= 0) {
    errors.push('Amount must be greater than 0');
  } else if (amount < 1) {
    errors.push('Minimum amount is GHS 1.00');
  } else if (amount > 10000) {
    errors.push('Maximum amount is GHS 10,000 per transaction');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Gets all available mobile money providers
 */
export const getAvailableProviders = (): Array<{
  id: MobileMoneyProvider;
  name: string;
  description: string;
  ussdCode: string;
}> => {
  return Object.entries(PROVIDERS).map(([id, provider]) => ({
    id: id as MobileMoneyProvider,
    name: provider.name,
    description: provider.description,
    ussdCode: provider.ussdCode,
  }));
};

/**
 * Formats mobile money transaction receipt
 */
export const formatMobileMoneyReceipt = (
  provider: MobileMoneyProvider,
  phoneNumber: string,
  amount: number,
  transactionId: string,
  timestamp: string
): string => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const date = new Date(timestamp).toLocaleString('en-US');

  return `
Digital Susu - Wallet Loading Receipt
====================================
Provider: ${PROVIDERS[provider]?.name || provider}
Phone: ${normalizedPhone}
Amount: GHS ${amount.toFixed(2)}
Transaction ID: ${transactionId}
Date & Time: ${date}

Status: Pending
You will receive a USSD prompt on your phone to confirm the payment.

====================================
Keep this receipt for your records.
  `.trim();
};

/**
 * Checks if a phone number belongs to a specific provider
 */
export const phoneNumberBelongsToProvider = (
  phoneNumber: string,
  provider: MobileMoneyProvider
): boolean => {
  const detectedProvider = getProviderFromPhone(phoneNumber);
  return detectedProvider === provider;
};
