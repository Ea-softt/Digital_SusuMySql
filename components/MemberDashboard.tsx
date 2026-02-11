
import React, { useState, useEffect, useMemo } from 'react';
import { Group, Transaction, User, UserRole } from '../types';
import { StatsCard } from './StatsCard';
import { Wallet, Calendar, PiggyBank, History, Search, ArrowRight, CheckCircle, Clock, ShieldAlert, UserCheck, LayoutDashboard, Users, DollarSign, Smartphone, Loader2, Lock, Copy, AlertTriangle, X, Shield, Settings, LogOut, Trash2, ArrowLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, CartesianGrid, PieChart, Pie, Legend } from 'recharts';
import { db } from '../services/database';
import { moneyFormatter } from '../utils/formatters';
import { processGhanaMobileMoneyPayment, validateMobileMoneyTransaction, normalizePhoneNumber } from '../services/ghanaMoneyService';
// reverted CediSign usage: using DollarSign from lucide-react

interface MemberDashboardProps {
  group: Group;
  transactions: Transaction[];
  userId: string;
  onRefresh?: () => void;
  currentUser: User;
  members: User[];
}

type Tab = 'overview' | 'members' | 'transactions' | 'withdraw' | 'schedule' | 'settings';

export const MemberDashboard: React.FC<MemberDashboardProps> = ({ group, transactions, userId, onRefresh, currentUser, members }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showWalletInNewState, setShowWalletInNewState] = useState(false);

  // Contribution State
  const [isContributing, setIsContributing] = useState(false);

  // Wallet Load State
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [momoDetails, setMomoDetails] = useState({ provider: 'MTN', number: currentUser.phoneNumber || '', amount: '' });
  const [isProcessingWallet, setIsProcessingWallet] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  // Withdraw State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);

  const [groupContributions, setGroupContributions] = useState<Transaction[]>([]);
  const [memberIdSet, setMemberIdSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (group.id) {
        db.getGroupContributionTransactions(group.id).then(setGroupContributions);

        // Fetch memberships to filter members list
        fetch('/api/group-memberships')
            .then(res => res.json())
            .then((data: any[]) => {
                const ids = new Set<string>();
                if (Array.isArray(data)) {
                    data.forEach(m => {
                        if (m.group_id === group.id && m.status === 'ACTIVE') {
                            ids.add(m.user_id);
                        }
                    });
                }
                setMemberIdSet(ids);
            })
            .catch(err => console.error("Error fetching memberships:", err));
    }
  }, [group.id, onRefresh]);

  // Filter out superusers from the members list used in this dashboard.
  // This enforces the exclusion at the data level for this view.
  const visibleMembers = useMemo(() => {
    return members.filter(m => m.role !== UserRole.SUPERUSER && memberIdSet.has(m.id));
    return members.filter(m => m.role !== UserRole.SUPERUSER && memberIdSet.has(m.id) && m.status !== 'SUSPENDED');
  }, [members, memberIdSet]);

  // Filter the payout schedule to only include visible members
  const visibleSchedule = useMemo(() => {
    return group.payoutSchedule.filter(id => visibleMembers.some(m => m.id === id));
  }, [group.payoutSchedule, visibleMembers]);

  const isGlobalContext = currentUser.status === 'NEW' || !group.id;
  const currency = group.currency || 'GHS';

  const allUserTransactions = useMemo(() => 
    transactions.filter(t => t.userId === userId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
  [transactions, userId]);

  const activeGroupTransactions = useMemo(() => {
      const txs = isGlobalContext 
        ? transactions.filter(t => t.userId === userId && !t.groupId)
        : transactions.filter(t => t.userId === userId && t.groupId === group.id);
      return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, userId, group.id, isGlobalContext]);

  const totalContributed = activeGroupTransactions
    .filter(t => t.type === 'CONTRIBUTION' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate "Wallet Balance" GLOBALLY to ensure consistency across groups
  const totalPayoutsReceived = allUserTransactions
    .filter(t => t.type === 'PAYOUT' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalDeposits = allUserTransactions
    .filter(t => t.type === 'DEPOSIT' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawals = allUserTransactions
    .filter(t => t.type === 'WITHDRAWAL' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalGlobalContributions = allUserTransactions
    .filter(t => t.type === 'CONTRIBUTION' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.amount, 0);

  const walletBalance = totalPayoutsReceived + totalDeposits - totalWithdrawals - totalGlobalContributions;

  // --- ASYNC HANDLERS FOR MYSQL ---

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setIsJoining(true);

    try {
        const result = await db.joinGroupRequest(userId, joinCode);
        if (result.success) {
            if (onRefresh) onRefresh();
            alert("Request sent successfully! Wait for leader approval.");
        } else {
            setJoinError(result.message);
        }
    } catch (err) {
        setJoinError("Connection to API failed.");
    } finally {
        setIsJoining(false);
    }
  };

  const handleAcceptInvite = async () => {
      setIsJoining(true);
      try {
          await db.updateUser(userId, { status: 'ACTIVE' });
          if (onRefresh) onRefresh();
      } catch (err) {
          console.error("Failed to accept invite", err);
      } finally {
          setIsJoining(false);
      }
  };

  const handlePayContribution = async () => {
      if (walletBalance < group.contributionAmount) {
          alert(`Insufficient wallet balance. Please load ${currency} ${group.contributionAmount - walletBalance} first.`);
          setWalletModalOpen(true);
          return;
      }

      setIsContributing(true);
      try {
          const newTx: Transaction = {
              id: `tx-c-${Date.now()}`,
              userId: currentUser.id,
              userName: currentUser.name,
              type: 'CONTRIBUTION',
              amount: group.contributionAmount,
              date: new Date().toISOString().split('T')[0],
              status: 'COMPLETED',
              groupId: group.id,
          };
          await db.addTransaction(newTx, group.id);
          if (onRefresh) onRefresh();
          alert(`Successfully contributed ${currency} ${group.contributionAmount}!`);
      } catch (err) {
          alert("Payment failed. Please try again.");
      } finally {
          setIsContributing(false);
      }
  };

  const handleLoadWallet = async () => {
       if (!momoDetails.amount) {
           alert('Please enter an amount.');
           return;
       }

       if (!currentUser.phoneNumber) {
           alert('Please add a phone number to your profile first.');
           return;
       }

       setIsProcessingWallet(true);
       
       try {
           const amount = Number(momoDetails.amount);
           const phoneNumber = currentUser.phoneNumber;

           // Validate the mobile money transaction
           const validation = validateMobileMoneyTransaction(
               momoDetails.provider as any,
               phoneNumber,
               amount
           );

           if (!validation.valid) {
               alert(`Validation failed:\n${validation.errors.join('\n')}`);
               setIsProcessingWallet(false);
               return;
           }

           // Process Ghana Mobile Money Payment
           const paymentResult = await processGhanaMobileMoneyPayment(
               momoDetails.provider as any,
               phoneNumber,
               amount,
               currency
           );

           if (!paymentResult.success) {
               alert(`Payment Failed: ${paymentResult.error || paymentResult.message}`);
               setIsProcessingWallet(false);
               return;
           }

           // Create transaction record
           const newTx: Transaction = {
                id: paymentResult.transactionId || `tx-d-${Date.now()}`,
                userId: currentUser.id,
                userName: currentUser.name,
                type: 'DEPOSIT',
                amount: amount,
                date: new Date().toISOString().split('T')[0],
                status: 'PENDING', // Mobile Money transactions are initially pending
                groupId: isGlobalContext ? undefined : group.id,
           };
           await db.addTransaction(newTx, isGlobalContext ? undefined : group.id);
           if (onRefresh) onRefresh();
           setWalletModalOpen(false);
           setMomoDetails(prev => ({...prev, amount: ''}));
           alert(`Payment Initiated!\n\n${paymentResult.message}\n\nTransaction ID: ${paymentResult.transactionId}`);
       } catch (err) {
           alert(`Failed to load wallet: ${err instanceof Error ? err.message : 'Unknown error'}`);
       } finally {
           setIsProcessingWallet(false);
       }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
      e.preventDefault();
      const amount = Number(withdrawAmount);
      
      if (!amount || amount <= 0) {
          alert("Please enter a valid amount.");
          return;
      }
      if (amount > walletBalance) {
          alert("Insufficient wallet balance.");
          return;
      }
      if (!withdrawPassword) {
          alert("Password is required.");
          return;
      }

      setIsProcessingWithdraw(true);
      try {
          const newTx: Transaction = {
              id: `tx-w-${Date.now()}`,
              userId: currentUser.id,
              userName: currentUser.name,
              type: 'WITHDRAWAL',
              amount: amount,
              date: new Date().toISOString().split('T')[0],
              status: 'COMPLETED',
              groupId: isGlobalContext ? undefined : group.id,
          };
          await db.addTransaction(newTx, isGlobalContext ? undefined : group.id);
          setWithdrawAmount('');
          setWithdrawPassword('');
          if (onRefresh) onRefresh();
          alert(`Successfully withdrew ${currency} ${amount} to your Mobile Money wallet.`);
      } catch (err) {
          alert("Withdrawal failed.");
      } finally {
          setIsProcessingWithdraw(false);
      }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://digitalsusu.app/join/${group.inviteCode}`);
    alert("Group invite link copied to clipboard!");
  };

  function renderTransactions() { return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                 <h3 className="text-lg font-bold text-gray-800 dark:text-white">My Transactions</h3>
                 <p className="text-gray-500 dark:text-gray-400 text-sm">History of your contributions and payouts.</p>
            </div>
            <div className="flex gap-3">
                <button
                    onClick={() => {
                        setMomoDetails(prev => ({...prev, number: currentUser.phoneNumber || ''}));
                        setWalletModalOpen(true);
                    }}
                    className="bg-white dark:bg-gray-700 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                >
                    <Smartphone className="w-4 h-4" /> Load Wallet
                </button>
                <button
                    onClick={() => setWithdrawModalOpen(true)}
                    className="bg-white dark:bg-gray-700 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                >
                    <ArrowRight className="w-4 h-4" /> Withdraw
                </button>
                {!isGlobalContext && <button
                    onClick={handlePayContribution}
                    disabled={isContributing || group.payoutSchedule.length === 0}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isContributing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                    Make Contribution
                </button>
                }
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        <tr>
                            <th className="px-6 py-4 font-medium">Transaction ID</th>
                            <th className="px-6 py-4 font-medium">Type</th>
                            <th className="px-6 py-4 font-medium">Date</th>
                            <th className="px-6 py-4 font-medium">Amount</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {activeGroupTransactions.length > 0 ? activeGroupTransactions.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="px-6 py-4 font-mono text-gray-500 dark:text-gray-400">#{t.id.toUpperCase()}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        t.type === 'CONTRIBUTION' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 
                                        t.type === 'PAYOUT' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                        t.type === 'DEPOSIT' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' :
                                        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                    }`}>
                                        {t.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{new Date(t.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                    {(t.type === 'PAYOUT' || t.type === 'DEPOSIT') ? '+' : '-'}{currency} {t.amount}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        t.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 
                                        t.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            t.status === 'COMPLETED' ? 'bg-green-500' : 
                                            t.status === 'PENDING' ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}></span>
                                        {t.status}
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-gray-500">No transactions found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  ); }

  const renderWithdraw = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-xl p-6 text-white shadow-lg">
                <p className="text-purple-200 text-sm font-medium mb-1">Available to Withdraw</p>                
                <h2 className="text-4xl font-bold mb-4">{moneyFormatter(walletBalance, currency)}</h2>
                <div className="flex gap-4 text-xs text-purple-200">
                    <div>
                        <span className="block opacity-70">Payouts</span>
                        <span className="font-bold text-white">GHS {totalPayoutsReceived}</span>
                    </div>
                    <div>
                        <span className="block opacity-70">Deposits</span>
                        <span className="font-bold text-white">GHS {totalDeposits}</span>
                    </div>
                    <div>
                        <span className="block opacity-70">Contributed</span>
                        <span className="font-bold text-white">GHS {totalGlobalContributions}</span>
                    </div>
                    <div>
                        <span className="block opacity-70">Withdrawn</span>
                        <span className="font-bold text-white">GHS {totalWithdrawals}</span>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <Smartphone className="w-5 h-5" /> Withdraw to Mobile Money
                </h3>
                <form onSubmit={handleWithdraw} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ({currency})</label>
                        <input 
                            type="number"
                            value={withdrawAmount}
                            onChange={e => setWithdrawAmount(e.target.value)}
                            className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-white"
                            placeholder="0.00"
                            max={walletBalance}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="password"
                                value={withdrawPassword}
                                onChange={e => setWithdrawPassword(e.target.value)}
                                className="w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-white"
                                placeholder="Enter password to confirm"
                            />
                        </div>
                    </div>
                    <button 
                        type="submit"
                        disabled={isProcessingWithdraw || walletBalance <= 0}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                            {isProcessingWithdraw ? <Loader2 className="animate-spin w-5 h-5" /> : 'Confirm Withdrawal'}
                    </button>
                </form>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-gray-800 dark:text-white">Withdrawal History</h3>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Amount</th>
                                <th className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                  <tbody className="divide-y divide-gray-100 darke-gray-700">
                            {activeGroupTransactions.filter(t => t.type === 'WITHDRAWAL').map(tx => (
                                <tr key={tx.id}>
                                    <td className="px-6 py-4 text-gray-900 dark:text-white">{new Date(tx.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{currency} {tx.amount}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                            Completed
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {activeGroupTransactions.filter(t => t.type === 'WITHDRAWAL').length === 0 && (
                                <tr><td colSpan={3} className="p-6 text-center text-gray-500">No withdrawal history.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
          </div>
      </div>
  );

  function renderWithdrawModal() {
    if (!withdrawModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                       <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                       Withdraw Funds
                  </h3>
                  <button onClick={() => !isProcessingWithdraw && setWithdrawModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <X className="w-5 h-5" />
                  </button>
              </div>
              
              <div className="p-6 space-y-5">
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                      <p className="text-sm text-purple-600 dark:text-purple-300 mb-1">Available Balance</p>
                      <p className="text-2xl font-bold text-purple-800 dark:text-purple-100">{moneyFormatter(walletBalance, currency)}</p>
                  </div>

                  <form onSubmit={(e) => { handleWithdraw(e); setWithdrawModalOpen(false); }} id="withdraw-form" className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ({currency})</label>
                            <input 
                                type="number"
                                value={withdrawAmount}
                                onChange={e => setWithdrawAmount(e.target.value)}
                                className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="0.00"
                                max={walletBalance}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="password"
                                    value={withdrawPassword}
                                    onChange={e => setWithdrawPassword(e.target.value)}
                                    className="w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Enter password to confirm"
                                    required
                                />
                            </div>
                        </div>
                  </form>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                  <button 
                      type="submit"
                      form="withdraw-form"
                      disabled={isProcessingWithdraw || walletBalance <= 0}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-lg transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                      {isProcessingWithdraw ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Withdrawal'}
                  </button>
              </div>
          </div>
      </div>
    );
  };

  function renderWalletModal() {
    if (!walletModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                       <Smartphone className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                       Load Wallet via Mobile Money
                  </h3>
                  <button onClick={() => !isProcessingWallet && setWalletModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <X className="w-5 h-5" />
                  </button>
              </div>
              
              <div className="p-6 space-y-5">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Provider</label>
                      <div className="grid grid-cols-3 gap-3">
                          {['MTN', 'Telecel', 'AT'].map(p => (
                              <button
                                  key={p}
                                  onClick={() => setMomoDetails(prev => ({...prev, provider: p}))}
                                  className={`py-2.5 rounded-lg border text-sm font-bold transition-all ${momoDetails.provider === p 
                                      ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500 text-primary-700 dark:text-primary-400 ring-1 ring-primary-500' 
                                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                              >
                                  {p}
                              </button>
                          ))}
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Registered Mobile Money Number</label>
                      <div className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-900 dark:text-white font-mono flex items-center justify-between">
                          <span className="flex items-center gap-2">
                              <Smartphone className="w-4 h-4 text-gray-500" />
                              {normalizePhoneNumber(currentUser.phoneNumber || 'Not set')} 
                          </span>
                          <span className="text-[10px] font-bold uppercase text-gray-400 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded">Verified</span>
                      </div>
                  </div>

                  <div>
                      <div className="flex items-center justify-between">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ({currency})</label>
                          {!isGlobalContext && <button
                              type="button"
                              onClick={() => setMomoDetails(prev => ({ ...prev, amount: String(group.contributionAmount) }))}
                              className="text-sm text-primary-600 hover:underline"
                          >
                              Use contribution: {moneyFormatter(group.contributionAmount, currency)}
                          </button>}
                      </div>
                      <input 
                          type="number" 
                          value={momoDetails.amount}
                          onChange={(e) => setMomoDetails(prev => ({...prev, amount: e.target.value}))}
                          placeholder="0.00"
                          className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                      />
                  </div>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                  <button 
                      onClick={handleLoadWallet}
                      disabled={isProcessingWallet || !currentUser.phoneNumber || !momoDetails.amount}
                      className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-lg transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                      {isProcessingWallet ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                      {isProcessingWallet ? 'Processing Payment...' : 'Confirm Payment'}
                  </button>
              </div>
          </div>
      </div>
    );
  };

  // --- EARLY RETURNS FOR VERIFICATION STATUS ---

  if (currentUser.verificationStatus !== 'VERIFIED') {
      return (
          <div className="max-w-md mx-auto mt-10 text-center animate-fade-in">
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-purple-100 dark:border-gray-700 overflow-hidden">
                  <div className="bg-purple-600 p-10 flex justify-center">
                      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                          <Shield className="w-10 h-10 text-white animate-pulse" />
                      </div>
                  </div>
                  <div className="p-8">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Verification in Progress</h2>
                      <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                          Your identity documents are being reviewed by the Digital Susu administrators. 
                          For security and compliance, all members must be verified before they can join groups or handle transactions.
                      </p>
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-sm flex items-start gap-3 text-left">
                          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                                <p className="font-bold">What's Next?</p>
                              <p className="mt-1">You will receive a notification once your KYC is approved. This usually takes 1-2 business days.</p>
                          </div>
                      </div>
                      <button 
                         onClick={() => onRefresh && onRefresh()}
                         className="mt-8 w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                      >
                         <History className="w-4 h-4" /> Check Again
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  if (currentUser.status === 'SUSPENDED') {
      return (
          <div className="max-w-md mx-auto mt-10 text-center animate-fade-in">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-red-100 dark:border-red-900 p-8">
                  <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ShieldAlert className="w-10 h-10 text-red-600 dark:text-red-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Suspended</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                      Your account has been suspended by the system administrator. 
                      Please contact support for assistance.
                  </p>
              </div>
          </div>
      );
  }

  // --- EARLY RETURNS FOR GROUP STATUS ---

  if (isGlobalContext) {
      if (showWalletInNewState) {
          return (
              <div className="space-y-6 animate-fade-in p-6">
                  <div className="flex items-center gap-4 mb-6">
                      <button 
                          onClick={() => setShowWalletInNewState(false)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                      >
                          <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                      </button>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Wallet</h2>
                  </div>
                  <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-xl p-6 text-white shadow-lg">
                        <p className="text-purple-200 text-sm font-medium mb-1">Available to Withdraw</p>                
                        <h2 className="text-4xl font-bold mb-4">{moneyFormatter(walletBalance, currency)}</h2>
                        <div className="flex gap-4 text-xs text-purple-200">
                            <div>
                                <span className="block opacity-70">Payouts</span>
                                <span className="font-bold text-white">GHS {totalPayoutsReceived}</span>
                            </div>
                            <div>
                                <span className="block opacity-70">Deposits</span>
                                <span className="font-bold text-white">GHS {totalDeposits}</span>
                            </div>
                            <div>
                                <span className="block opacity-70">Contributions</span>
                                <span className="font-bold text-white">GHS {totalGlobalContributions}</span>
                            </div>
                            <div>
                                <span className="block opacity-70">Withdrawn</span>
                                <span className="font-bold text-white">GHS {totalWithdrawals}</span>
                            </div>
                        </div>
                    </div>
                  {renderTransactions()}
                  {renderWalletModal()}
                  {renderWithdrawModal()}
              </div>
          );
      }

      return (
          <div className="max-w-md mx-auto mt-10">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                      <div className="bg-primary-600 p-8 text-center">
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                          <Search className="w-8 h-8 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold text-white">Join a Susu Group</h2>
                      <p className="text-primary-100 text-sm mt-2">Enter the unique code or group name provided by your admin.</p>
                  </div>
                      <div className="p-8">
                          <form onSubmit={handleJoinGroup} className="space-y-6">
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Group Code or Name</label>
                                  <input
                                      type="text"
                                      value={joinCode}
                                      onChange={(e) => setJoinCode(e.target.value)}
                                      placeholder="e.g. SUSU-2024-FAM"
                                      className="w-full p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 font-mono text-center text-lg uppercase tracking-wider"
                                      required
                                  />
                              </div>

                              {joinError && (
                                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2 justify-center">
                                      <ShieldAlert className="w-4 h-4" /> {joinError}
                                  </div>
                              )}

                              <button
                                  type="submit"
                                  disabled={isJoining}
                                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
                              >
                                  {isJoining ? 'Sending Request...' : 'Send Join Request'}
                                  {!isJoining && <ArrowRight className="w-5 h-5" />}
                              </button>
                          </form>
                      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 text-center">
                          <button 
                              onClick={() => setShowWalletInNewState(true)}
                              className="text-primary-600 dark:text-primary-400 font-bold hover:underline flex items-center justify-center gap-2 mx-auto"
                          >
                              <Wallet className="w-5 h-5" /> Access My Wallet
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  if (currentUser.status === 'PENDING') {
      return (
          <div className="max-w-md mx-auto mt-10 text-center">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-yellow-100 dark:border-yellow-900 p-8">
                  <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Clock className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Request Pending</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                      Your request to join <span className="font-bold text-gray-900 dark:text-white">{group.name}</span> has been sent. 
                      Please wait for the Group Admin to approve your membership.
                  </p>
              </div>
          </div>
      );
  }

  if (currentUser.status === 'INVITED') {
      return (
          <div className="max-w-md mx-auto mt-10">
               <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-primary-100 dark:border-gray-700 overflow-hidden">
                  <div className="p-8 text-center border-b border-gray-100 dark:border-gray-700">
                      <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                          <UserCheck className="w-10 h-10 text-primary-600 dark:text-primary-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">You're Invited!</h2>
                      <p className="text-gray-500 dark:text-gray-400 mt-2">
                          The admin of <span className="font-bold text-primary-600 dark:text-primary-400">{group.name}</span> has invited you to join.
                      </p>
                  </div>
                  <div className="p-8 bg-gray-50 dark:bg-gray-700/30">
                      <div className="grid grid-cols-2 gap-4">
                          <button className="py-3 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                              Decline
                          </button>
                          <button 
                              onClick={handleAcceptInvite}
                              disabled={isJoining}
                              className="py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                          >
                              {isJoining ? 'Joining...' : 'Accept Invite'}
                          </button>
                      </div>
                  </div>
               </div>
          </div>
      );
  }

  const renderOverview = () => {
    const hasActiveCycle = group.cycleStartDate && group.cycleEndDate;
    const now = new Date();
    
    let cycleProgress = 0;
    let daysRemaining = 0;
    let isPaid = false;
    let amountPaid = 0;
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    const COLORS = ['#10b981', '#f59e0b'];

    if (hasActiveCycle) {
        startDate = new Date(group.cycleStartDate!);
        endDate = new Date(group.cycleEndDate!);
        
        const totalDuration = endDate.getTime() - startDate.getTime();
        const elapsed = now.getTime() - startDate.getTime();
        
        // Clamp progress between 0 and 100
        cycleProgress = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
        daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Check contribution for THIS cycle
        const cycleContributions = activeGroupTransactions.filter(t => 
            t.type === 'CONTRIBUTION' && 
            t.status === 'COMPLETED' &&
            new Date(t.date).getTime() >= startDate!.getTime() &&
            new Date(t.date).getTime() <= endDate!.getTime()
        );
        
        amountPaid = cycleContributions.reduce((sum, t) => sum + t.amount, 0);
        isPaid = amountPaid >= group.contributionAmount;
    }

    // Calculate Payment Progress for the Group
    const cycleStartTime = startDate ? startDate.getTime() : new Date().getTime();
    const currentCycleContribs = groupContributions.filter(t =>
        new Date(t.date).getTime() >= cycleStartTime && t.status === 'COMPLETED'
    );
    const paidMemberIds = new Set(currentCycleContribs.map(t => t.userId));
    const paidCount = paidMemberIds.size;
    const pendingCount = Math.max(0, visibleMembers.length - paidCount);
    const pieData = [{ name: 'Paid', value: paidCount }, { name: 'Pending', value: pendingCount }];

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
            title="Total Contributed"
            value={moneyFormatter(totalContributed, currency)}
            icon={PiggyBank}
            color="bg-primary-600"
            />
            <StatsCard
            title="Next Payout Date"
            value={hasActiveCycle && endDate ? endDate.toLocaleDateString() : 'TBD'}
            trend={hasActiveCycle ? `${daysRemaining} days left` : 'No active cycle'}
            trendUp={true}
            icon={Calendar}
            color="bg-blue-600"
            />
            <StatsCard
            title="My Wallet Balance"
            value={moneyFormatter(walletBalance, currency)}
            icon={Wallet}
            color="bg-purple-600"
            />
            <StatsCard
            title="Group Cycle"
            value={`#${group.cycleNumber}`}
            trend="Active"
            trendUp={true}
            icon={History}
            color="bg-orange-500"
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Active Cycle Overview</h3>
                {hasActiveCycle && (
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">
                        Cycle #{group.cycleNumber}
                    </span>
                )}
            </div>
            
            {hasActiveCycle ? (
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-500 dark:text-gray-400">Cycle Progress</span>
                            <span className="font-bold text-gray-900 dark:text-white">{Math.round(cycleProgress)}%</span>
                        </div>
                        <div className="h-32 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={[{ name: 'Progress', value: cycleProgress }]}>
                                    <defs>
                                        <linearGradient id="colorProgress" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                            <stop offset={`${cycleProgress}%`} stopColor="#3b82f6" stopOpacity={0.8}/>
                                            <stop offset={`${cycleProgress}%`} stopColor="#e5e7eb" stopOpacity={0.2}/>
                                            <stop offset="100%" stopColor="#e5e7eb" stopOpacity={0.2}/>
                                        </linearGradient>
                                    </defs>
                                    <Tooltip cursor={false} content={() => null} />
                                    <Area type="monotone" dataKey="value" stroke="none" fill="url(#colorProgress)" fillOpacity={1} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                                    <XAxis hide />
                                    <YAxis hide domain={[0, 100]} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                            <span>Started: {startDate?.toLocaleDateString()}</span>
                            <span>Ends: {endDate?.toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                    <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No active contribution cycle.</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">Waiting for admin to start the next cycle.</p>
                </div>
            )}
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Payment Progress (Current Cycle)</h3>
                <div className="flex-1 min-h-[200px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value" stroke="none">
                                {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{Math.round((paidCount / (visibleMembers.length || 1)) * 100)}%</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">PAID</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  };

  const renderMembers = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Group Members</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">View your trusted circle.</p>
              </div>
              
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-2 rounded-lg border border-gray-200 dark:border-gray-600 w-full sm:w-auto">
                  <span className="text-xs text-gray-500 dark:text-gray-400 px-2">Invite Code:</span>
                  <code className="font-mono text-sm font-bold text-primary-700 dark:text-primary-400">
                      {group.inviteCode}
                  </code>
                  <button onClick={copyLink} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors" title="Copy Invite Link">
                      <Copy className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                  </button>
              </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          <tr>
                              <th className="px-6 py-4 font-medium">Member</th>
                              <th className="px-6 py-4 font-medium">Role</th>
                              <th className="px-6 py-4 font-medium">Joined</th>
                              <th className="px-6 py-4 font-medium">Reliability</th>
                          </tr>
                      </thead>
                       <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                           {visibleMembers.map(member => (
                               <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                   <td className="px-6 py-4">
                                       <div className="flex items-center gap-3">
                                           <img src={member.avatar} alt="" className="w-8 h-8 rounded-full" />
                                           <div>
                                               <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                                              <p className="text-xs text-gray-500 dark:text-gray-400">{member.occupation}</p>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${member.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                          {member.role}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{member.joinDate}</td>
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                          <div className="w-16 h-2 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden">
                                              <div className="h-full bg-green-500" style={{ width: `${member.reliabilityScore || 0}%` }}></div>
                                          </div>
                                          <span className="text-xs text-gray-500">{member.reliabilityScore}%</span>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
  );

  const renderSchedule = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Payout Schedule</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">See when you and other members will receive the pot.</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {visibleSchedule.map((memberId, index) => {
                    const member = visibleMembers.find(m => m.id === memberId);
                    if (!member) return null;
                    const payoutDate = new Date();
                    payoutDate.setMonth(payoutDate.getMonth() + index);
                    
                    const isMe = memberId === userId;

                    return (
                        <div key={memberId} className={`p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 ${isMe ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}>
                             <div className="flex items-center gap-4">
                                <span className={`w-8 h-8 font-bold rounded-full flex items-center justify-center text-sm ${isMe ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                    {index + 1}
                                </span>
                                <div className="flex items-center gap-3">
                                    <img src={member.avatar} alt="" className="w-10 h-10 rounded-full" />
                                    <div>
                                        <p className={`font-medium ${isMe ? 'text-primary-700 dark:text-primary-400 font-bold' : 'text-gray-900 dark:text-white'}`}>
                                            {isMe ? 'You' : member.name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Payout Date: {payoutDate.toLocaleDateString()}</p>
                                    </div>
                                </div>
                             </div>
                             <div className="text-right font-bold text-gray-900 dark:text-white">
                                {moneyFormatter(group.scheduledPayoutAmount || 0, currency)}
                             </div>
                        </div>
                    );
                })}
          </div>
      </div>
  );

  const handleLeaveGroup = async () => {
      if (window.confirm("Are you sure you want to leave this group? You can join again later using the invite code.")) {
          const success = await db.leaveGroup(group.id, userId);
          if (success) {
              alert("You have successfully left the group.");
              if (onRefresh) onRefresh();
          } else {
              alert("Failed to leave group.");
          }
      }
  };

  const handleDeleteMembership = async () => {
      if (window.confirm("Are you sure you want to permanently delete your membership from this group? This action cannot be undone.")) {
          const success = await db.deleteMembership(group.id, userId);
          if (success) {
              alert("Your membership has been permanently deleted.");
              if (onRefresh) onRefresh();
          } else {
              alert("Failed to delete membership.");
          }
      }
  };

  const renderSettings = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Membership Settings</h3>
              
              <div className="space-y-4">
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
                      <div>
                          <h4 className="font-bold text-gray-800 dark:text-white">Leave Group</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Temporarily leave the group. You can rejoin later.</p>
                      </div>
                      <button 
                          onClick={handleLeaveGroup}
                          className="px-4 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg font-bold flex items-center gap-2 transition-colors"
                      >
                          <LogOut className="w-4 h-4" /> Leave Group
                      </button>
                  </div>

                  <div className="p-4 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
                      <div>
                          <h4 className="font-bold text-red-800 dark:text-red-200">Delete Membership</h4>
                          <p className="text-sm text-red-600 dark:text-red-300">Permanently remove yourself from this group.</p>
                      </div>
                      <button 
                          onClick={handleDeleteMembership}
                          className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold flex items-center gap-2 transition-colors"
                      >
                          <Trash2 className="w-4 h-4" /> Delete Membership
                      </button>
                  </div>
              </div>
          </div>
      </div>
  );

  return (
    <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-700 gap-6">
            {[
                { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                { id: 'members', label: 'Members', icon: Users },
                { id: 'transactions', label: 'Transactions', icon: DollarSign },
                { id: 'withdraw', label: 'Withdraw', icon: Smartphone },
                { id: 'schedule', label: 'Schedule', icon: Calendar },
                { id: 'settings', label: 'Settings', icon: Settings }
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`
                        flex items-center gap-2 pb-2 px-1 border-b-2 transition-colors whitespace-nowrap
                        ${activeTab === tab.id 
                            ? 'border-primary-600 dark:border-primary-400 text-primary-700 dark:text-primary-400 font-bold' 
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 font-medium'}
                    `}
                >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                </button>
            ))}
        </div>

        <div className="min-h-[500px]">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'members' && renderMembers()}
            {activeTab === 'transactions' && renderTransactions()}
            {activeTab === 'withdraw' && renderWithdraw()}
            {activeTab === 'schedule' && renderSchedule()}
            {activeTab === 'settings' && renderSettings()}
        </div>
        {renderWalletModal()}
        {renderWithdrawModal()}
    </div>
  );
};
