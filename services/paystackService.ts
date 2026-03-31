import PaystackPop from '@paystack/inline-js';

/**
 * Paystack Service for handling frontend payments and interacting with the backend for transfers.
 */

interface PaystackPaymentOptions {
  email: string;
  amount: number;
  currency: string;
  metadata?: any;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

/**
 * Initializes a Paystack inline payment popup.
 * @param options Payment configuration options
 */
export const initializePaystackPayment = async (options: PaystackPaymentOptions) => {
  try {
    // Fetch the Public Key from the backend to keep it out of the frontend source code bundle
    // Using relative path to utilize the Vite proxy defined in vite.config.ts
    const response = await fetch('/api/paystack/key', { cache: 'no-cache' });
    
    if (!response.ok) {
        throw new Error(`Server returned ${response.status} (${response.statusText}) at /api/paystack/key`);
    }

    const { publicKey } = await response.json();

    if (!publicKey) throw new Error("Public Key is missing in server response.");

    const paystack = new PaystackPop();
  
    paystack.newTransaction({
      key: publicKey,
      email: options.email,
      // Paystack expects amount in the smallest currency unit (e.g., pesewas for GHS)
      amount: Math.round(options.amount * 100),
      currency: options.currency,
      metadata: options.metadata,
      onSuccess: (transaction: any) => {
        // Transaction successful!
        options.onSuccess(transaction.reference);
      },
      onCancel: () => {
        options.onClose();
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Paystack Initialization Error:", errorMessage);
    alert(`Failed to initialize payment gateway: ${errorMessage}`);
    options.onClose();
  }
};

/**
 * Initiates a withdrawal request to the backend.
 * Note: Actual transfers must be handled server-side using your Secret Key.
 */
export const initiateWithdrawal = async (data: {
    amount: number;
    recipientEmail: string;
    accountNumber: string;
    provider: string;
    userId: string;
}) => {
    // This calls your server endpoint which implements the Node.js snippet you provided
    const response = await fetch('/api/paystack/withdraw', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Withdrawal failed at server level.');
    }
    
    return await response.json();
};