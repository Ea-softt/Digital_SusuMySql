
import React from 'react';
import { HelpCircle, ChevronDown, MessageCircle, Phone, Mail } from 'lucide-react';

export const HelpCenter: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
                <HelpCircle className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">How can we help you?</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Browse our frequently asked questions or contact our support team for assistance.
            </p>
        </div>
        
        {/* FAQ Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Frequently Asked Questions</h3>
            </div>
            
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                <details className="group p-6 cursor-pointer open:bg-gray-50 dark:open:bg-gray-700/30 transition-colors">
                    <summary className="flex items-center justify-between font-medium text-gray-900 dark:text-white list-none">
                        <span>How do I make a contribution?</span>
                        <ChevronDown className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        Go to your <strong>Dashboard</strong> or <strong>Transactions</strong> page. Click the "Make Contribution" or "Pay Now" button. The system will deduct funds from your loaded wallet balance. Ensure you have loaded your wallet via Mobile Money first.
                    </p>
                </details>
                
                <details className="group p-6 cursor-pointer open:bg-gray-50 dark:open:bg-gray-700/30 transition-colors">
                    <summary className="flex items-center justify-between font-medium text-gray-900 dark:text-white list-none">
                        <span>When do I receive my payout?</span>
                        <ChevronDown className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        Check the <strong>Schedule</strong> tab on your Dashboard. It lists the exact payout date for every member in the cycle. If you are the Admin, you can manually trigger payouts if the "Auto-Payout" feature is disabled.
                    </p>
                </details>

                <details className="group p-6 cursor-pointer open:bg-gray-50 dark:open:bg-gray-700/30 transition-colors">
                    <summary className="flex items-center justify-between font-medium text-gray-900 dark:text-white list-none">
                        <span>Is my money safe?</span>
                        <ChevronDown className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        Yes. Digital Susu uses secure ledgers to track every penny. Plus, Group Leaders verify all members through KYC (Know Your Customer) checks before they can join a circle. Your wallet balance is held in a secure trust account.
                    </p>
                </details>

                <details className="group p-6 cursor-pointer open:bg-gray-50 dark:open:bg-gray-700/30 transition-colors">
                    <summary className="flex items-center justify-between font-medium text-gray-900 dark:text-white list-none">
                        <span>How do I invite a friend?</span>
                        <ChevronDown className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        If you are an Admin, go to the <strong>Members</strong> tab and click "Invite Member". If you are a member, you can share the unique <strong>Invite Code</strong> found on your dashboard with your friends. They will need to enter this code during registration.
                    </p>
                </details>
            </div>
        </div>

        {/* Contact Support Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center text-green-600 dark:text-green-400 mb-4">
                    <MessageCircle className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">Chat with Support</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Start a live chat with our support team.</p>
                <button className="w-full py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                    Start Chat
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                    <Mail className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">Email Us</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Send us a detailed message.</p>
                <button className="w-full py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                    support@digitalsusu.app
                </button>
            </div>
        </div>
    </div>
  );
};
