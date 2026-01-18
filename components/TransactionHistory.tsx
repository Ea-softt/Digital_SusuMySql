
import React, { useState, useMemo } from 'react'; // Import React and hooks for state and memoization
import { Transaction } from '../types'; // Import Transaction interface
import { Search, Filter, ArrowUpRight, ArrowDownLeft, Calendar, CheckCircle, AlertCircle, Clock, PlusCircle } from 'lucide-react'; // Import icons for UI

// Define props interface for TransactionHistory component
interface TransactionHistoryProps {
  transactions: Transaction[]; // Array of transactions to display
  currency: string; // Currency symbol to display (e.g., GHS, USD)
}

// Main functional component for Transaction History
export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions, currency }) => {
  // State for the search input text
  const [searchTerm, setSearchTerm] = useState('');
  // State for the currently selected filter type ('ALL', 'CONTRIBUTION', 'PAYOUT', 'DEPOSIT')
  const [filterType, setFilterType] = useState<'ALL' | 'CONTRIBUTION' | 'PAYOUT' | 'DEPOSIT'>('ALL');

  // Filter and sort transactions based on search term and filter type
  // Used useMemo to optimize performance by only recalculating when dependencies change
  const filteredTransactions = useMemo(() => {
    // Start with the full list of transactions
    return transactions
      .filter(t => {
        // Check if transaction matches the selected filter type (or if ALL is selected)
        const matchesType = filterType === 'ALL' || t.type === filterType;
        
        // Check if transaction matches the search term (ID or User Name)
        // Convert both to lowercase for case-insensitive search
        const matchesSearch = 
          t.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
          t.id.toLowerCase().includes(searchTerm.toLowerCase());
          
        // Return true only if both conditions are met
        return matchesType && matchesSearch;
      })
      // Sort the filtered results by date in descending order (newest first)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchTerm, filterType]); // Dependencies for useMemo

  // Function to render the status badge based on transaction status
  const renderStatus = (status: Transaction['status']) => {
    // Switch statement to handle different statuses
    switch (status) {
      case 'COMPLETED': // Case for completed transactions
        return (
          // Green badge for success
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle className="w-3 h-3" /> Completed
          </span>
        );
      case 'PENDING': // Case for pending transactions
        return (
          // Yellow badge for pending
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'FAILED': // Case for failed transactions
        return (
          // Red badge for failure
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      default: // Default case (fallback)
        return null;
    }
  };

  // Render the component UI
  return (
    // Main container with styling
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in">
      
      {/* Header Section */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Transaction History</h2>
        
        {/* Controls Container (Search and Filter) */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          
          {/* Search Input Wrapper */}
          <div className="relative flex-1">
            {/* Search Icon */}
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            {/* Input Field */}
            <input
              type="text"
              placeholder="Search by ID or member name..." // Placeholder text
              value={searchTerm} // Controlled value
              onChange={(e) => setSearchTerm(e.target.value)} // Update state on change
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm text-gray-900 dark:text-white"
            />
          </div>

          {/* Filter Dropdown Wrapper */}
          <div className="flex items-center gap-2">
            {/* Filter Icon */}
            <Filter className="text-gray-400 w-4 h-4" />
            {/* Select Element */}
            <select
              value={filterType} // Controlled value
              onChange={(e) => setFilterType(e.target.value as any)} // Update state on change
              className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white cursor-pointer"
            >
              <option value="ALL">All Transactions</option>
              <option value="CONTRIBUTION">Contributions</option>
              <option value="PAYOUT">Payouts</option>
              <option value="DEPOSIT">Deposits</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Section - Responsive Overflow */}
      <div className="overflow-x-auto">
        {/* Table Element */}
        <table className="w-full text-left text-sm">
          {/* Table Header */}
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-6 py-4 font-medium">Transaction ID</th>
              <th className="px-6 py-4 font-medium">Member</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Date</th>
              <th className="px-6 py-4 font-medium text-right">Amount</th>
              <th className="px-6 py-4 font-medium text-right">Status</th>
            </tr>
          </thead>
          
          {/* Table Body */}
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {/* Check if we have transactions to display */}
            {filteredTransactions.length > 0 ? (
              // Map through filtered transactions
              filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  
                  {/* ID Column */}
                  <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                    #{tx.id.toUpperCase()}
                  </td>
                  
                  {/* Member Name Column */}
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {tx.userName}
                  </td>
                  
                  {/* Type Column */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      tx.type === 'CONTRIBUTION' 
                        ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' 
                        : tx.type === 'PAYOUT' 
                        ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                        : tx.type === 'DEPOSIT'
                        ? 'bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800'
                        : 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800' 
                    }`}>
                      {/* Icon based on type */}
                      {tx.type === 'CONTRIBUTION' ? <ArrowDownLeft className="w-3 h-3" /> : 
                       tx.type === 'DEPOSIT' ? <PlusCircle className="w-3 h-3" /> :
                       <ArrowUpRight className="w-3 h-3" />}
                      {tx.type}
                    </span>
                  </td>
                  
                  {/* Date Column */}
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {tx.date}
                  </td>
                  
                  {/* Amount Column */}
                  <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white font-mono">
                    {/* Prefix + or - based on type */}
                    {(tx.type === 'CONTRIBUTION' || tx.type === 'WITHDRAWAL') ? '-' : '+'}{currency} {tx.amount.toLocaleString()}
                  </td>
                  
                  {/* Status Column */}
                  <td className="px-6 py-4 text-right">
                    {renderStatus(tx.status)}
                  </td>
                </tr>
              ))
            ) : (
              // Empty State (No results)
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center justify-center">
                    <Search className="w-8 h-8 mb-2 opacity-20" />
                    <p>No transactions found matching your criteria.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};