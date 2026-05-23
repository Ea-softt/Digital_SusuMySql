declare module '@paystack/inline-js' {
  class PaystackPop {
    constructor();
    newTransaction(options: any): void;
    resumeTransaction(accessCode: string, options: any): void;
  }

  export default PaystackPop;
}