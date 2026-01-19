import React, { useState } from 'react';
import { Search, MessageCircle, Lightbulb, BookOpen, HelpCircle, ChevronDown, ChevronUp, Send, Loader2, AlertCircle, CheckCircle, Sparkles, Brain } from 'lucide-react';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  helpfulness?: number;
}

export const AIHelpCenter: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ type: 'user' | 'ai'; message: string }>>([]);
  const [showChat, setShowChat] = useState(false);

  const faqs: FAQItem[] = [
    {
      id: 'faq-1',
      category: 'Getting Started',
      question: 'What is Digital Susu and how does it work?',
      answer: 'Digital Susu is a mobile-first platform for managing rotating savings and credit associations (ROSCA). Users can join groups, make regular contributions, and receive lump sum payouts in turns. The platform handles transactions, member verification, and group management securely.',
      helpfulness: 45
    },
    {
      id: 'faq-2',
      category: 'Accounts & Profiles',
      question: 'How do I create a new user account?',
      answer: 'Click "Create User Profile" from the admin panel. Fill in the user\'s name, email, password, and optional details like phone number, occupation, and location. You can assign roles (Member, Admin, or Superuser) when creating the account. Members will need to complete KYC verification before participating in transactions.'
    },
    {
      id: 'faq-3',
      category: 'Groups & Contributions',
      question: 'How do I create a savings group?',
      answer: 'Navigate to the Groups section and click "Create New Group". Enter group name, select currency (GHS, USD, etc.), set contribution amount, and frequency (Weekly, Monthly, etc.). You can customize invite codes and welcome messages. Members can join using the invite code.'
    },
    {
      id: 'faq-4',
      category: 'Groups & Contributions',
      question: 'What happens if a member misses a contribution?',
      answer: 'The system tracks contribution payments. Admins can view payment history and send reminders to members. If a member continuously misses payments, they can be suspended from the group. The group settings determine whether missed payments affect their payout eligibility.'
    },
    {
      id: 'faq-5',
      category: 'Security & Verification',
      question: 'How does KYC verification work?',
      answer: 'Members must submit their KYC documents (ID verification, proof of address, etc.) during onboarding. The system uses AI-powered document verification to analyze and match submitted documents. Admins can manually review and approve, reject, or request additional documents. Users with high confidence scores can be auto-approved.'
    },
    {
      id: 'faq-6',
      category: 'Security & Verification',
      question: 'What security measures protect the platform?',
      answer: 'Digital Susu uses multiple security layers: real-time threat detection monitors unusual login patterns and device changes, multi-account fraud detection, transaction volume analysis, and audit logging of all admin actions. Suspicious accounts are flagged for manual review.'
    },
    {
      id: 'faq-7',
      category: 'Transactions & Payments',
      question: 'How are payments processed?',
      answer: 'Members can make contributions via mobile money (MTN, Vodafone, AirtelTigo) or bank transfer. The system records each transaction and calculates fees (default 2% platform fee). Payouts are processed in the sequence members joined or as configured by the group.'
    },
    {
      id: 'faq-8',
      category: 'Transactions & Payments',
      question: 'How do I withdraw funds as a superuser?',
      answer: 'Navigate to Platform Financials tab. Review available platform balance (generated from transaction fees). Enter withdrawal amount, select payment provider (MTN, Vodafone, etc.), enter destination phone number, and confirm with your password. Withdrawals are processed within 24 hours.'
    },
    {
      id: 'faq-9',
      category: 'Admin Management',
      question: 'How do I manage user roles?',
      answer: 'In User Management, select a user and click "Edit Role". You can change their role to Member, Admin, or Superuser. Admins manage specific groups. Superusers have platform-wide access. Note: You cannot change your own role.'
    },
    {
      id: 'faq-10',
      category: 'Admin Management',
      question: 'How do I backup and restore the database?',
      answer: 'Go to System Settings and click "Create Backup" to download a JSON backup of all platform data. To restore, click "Restore Database" and select a backup file. WARNING: Restore will overwrite all current data - ensure you have confirmed the action.'
    },
    {
      id: 'faq-11',
      category: 'Troubleshooting',
      question: 'Why can\'t I log in?',
      answer: 'Check that you\'re using the correct email and password. If you\'ve forgotten your password, use the "Forgot Password" option on the login page. If you see a security warning, your account may have been temporarily suspended due to suspicious activity. Contact the superuser administrator.'
    },
    {
      id: 'faq-12',
      category: 'Troubleshooting',
      question: 'How do I resolve a failed transaction?',
      answer: 'Check your mobile money balance and ensure you have sufficient funds. Verify the transaction amount is correct. If the issue persists, contact your mobile money provider to confirm the transaction wasn\'t processed. The system will retry failed transactions automatically.'
    }
  ];

  const categories = ['all', 'Getting Started', 'Accounts & Profiles', 'Groups & Contributions', 'Security & Verification', 'Transactions & Payments', 'Admin Management', 'Troubleshooting'];

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    // Add user message to chat
    setChatHistory(prev => [...prev, { type: 'user', message: chatMessage }]);
    setChatMessage('');
    setIsChatLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        'Based on your question, here\'s what I found: The Digital Susu platform provides comprehensive tools for managing group savings. You can create groups, verify members through KYC, and track all transactions securely. Would you like more details about any specific feature?',
        'That\'s a great question! The system uses AI-powered security monitoring to detect unusual patterns like multiple failed logins, suspicious device changes, and high transaction volumes. All admin actions are logged for accountability. Is there a specific security concern you\'d like to address?',
        'I recommend following these best practices: 1) Regularly review member KYC status, 2) Monitor transaction patterns for fraud, 3) Keep backups of your database, 4) Update group settings to match your community\'s needs. Would you like guidance on any of these?',
        'You can resolve this by: First, check if all required information is provided. Second, ensure the user has completed KYC verification. Third, verify that there are no pending security alerts on their account. Let me know if you need help with specific steps!'
      ];

      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setChatHistory(prev => [...prev, { type: 'ai', message: randomResponse }]);
      setIsChatLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8" />
          <h1 className="text-3xl font-bold">AI Help Center</h1>
        </div>
        <p className="text-purple-100">Get instant answers to your questions about Digital Susu platform management</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search help articles, guides, and FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none dark:text-white shadow-sm"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full font-medium transition-colors text-sm ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* FAQ List */}
          <div className="space-y-3">
            {filteredFAQs.length > 0 ? (
              filteredFAQs.map(faq => (
                <div
                  key={faq.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{faq.question}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{faq.category}</p>
                      </div>
                    </div>
                    {expandedFAQ === faq.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>

                  {expandedFAQ === faq.id && (
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{faq.answer}</p>
                      {faq.helpfulness !== undefined && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex items-center gap-2">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Was this helpful?</span>
                          <button className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50">
                            Yes ({faq.helpfulness})
                          </button>
                          <button className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
                            No
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <HelpCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No articles found matching your search.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try different keywords or browse all categories.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Chat & Resources */}
        <div className="space-y-6">
          {/* AI Chat Widget */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-[500px]">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              <h3 className="font-bold">AI Assistant</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-700/30">
              {chatHistory.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Ask me anything about Digital Susu!</p>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                        msg.type === 'user'
                          ? 'bg-purple-600 text-white rounded-br-none'
                          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={isChatLoading || !chatMessage.trim()}
                  className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-70"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Quick Resources */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-900/50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-bold text-blue-900 dark:text-blue-200">Quick Tips</h3>
            </div>
            <ul className="space-y-3 text-sm text-blue-800 dark:text-blue-300">
              <li className="flex gap-2">
                <span>•</span>
                <span>Use strong passwords for all accounts</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Review member KYC monthly</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Create regular database backups</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Monitor security alerts daily</span>
              </li>
            </ul>
          </div>

          {/* Documentation Link */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-bold text-gray-900 dark:text-white">Need More Help?</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Browse our complete documentation or contact support.
            </p>
            <button className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm transition-colors">
              View Documentation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
