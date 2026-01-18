
import React, { useState, useEffect } from 'react';
import { Group, Transaction, User } from '../types';
import { StatsCard } from './StatsCard';
import { Wallet, Calendar, PiggyBank, History, Search, ArrowRight, CheckCircle, Clock, ShieldAlert, UserCheck, LayoutDashboard, Users, DollarSign, Smartphone, Loader2, Lock, Copy, AlertTriangle, X, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { db } from '../services/database';

interface MemberDashboardProps {
  group: Group;
  transactions: Transaction[];
  userId: string;
  onRefresh?: () => void;
  currentUser: User;
  members: User[];
}

type Tab = 'overview' | 'members' | 'transactions' | 'withdraw' | 'schedule';

export const MemberDashboard: React.FC<MemberDashboardProps> = ({ group, transactions, userId, onRefresh, currentUser, members }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Contribution State
  const [isContributing, setIsContributing] = useState(false);

  // Wallet Load State
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [momoDetails, setMomoDetails] = useState({ provider: 'MTN', number: currentUser.phoneNumber || '', amount: '' });
  const [isProcessingWallet, setIsProcessingWallet] = useState(false);

  // Withdraw State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);

  // Derived Data
  const userTransactions = transactions.filter(t => t.userId === userId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalContributed = userTransactions
    .filter(t => t.type === 'CONTRIBUTION' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate "Wallet Balance" based on Payouts + Deposits minus Withdrawals
  const totalPayoutsReceived = userTransactions
    .filter(t => t.type === 'PAYOUT' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalDeposits = userTransactions
    .filter(t => t.type === 'DEPOSIT' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawals = userTransactions
    .filter(t => t.type === 'WITHDRAWAL' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.amount, 0);

  const walletBalance = totalPayoutsReceived + totalDeposits - totalWithdrawals;

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
          alert(`Insufficient wallet balance. Please load ${group.currency} ${group.contributionAmount - walletBalance} first.`);
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
              status: 'COMPLETED'
          };
          await db.addTransaction(newTx);
          if (onRefresh) onRefresh();
          alert(`Successfully contributed ${group.currency} ${group.contributionAmount}!`);
      } catch (err) {
          alert("Payment failed. Please try again.");
      } finally {
          setIsContributing(false);
      }
  };

  const handleLoadWallet = async () => {
       if (!momoDetails.amount) return;
       setIsProcessingWallet(true);
       
       try {
           const amount = Number(momoDetails.amount);
           const newTx: Transaction = {
                id: `tx-d-${Date.now()}`,
                userId: currentUser.id,
                userName: currentUser.name,
                type: 'DEPOSIT',
                amount: amount,
                date: new Date().toISOString().split('T')[0],
                status: 'COMPLETED'
           };
           await db.addTransaction(newTx);
           if (onRefresh) onRefresh();
           setWalletModalOpen(false);
           setMomoDetails(prev => ({...prev, amount: ''}));
           alert(`Successfully loaded ${group.currency} ${amount} to your wallet.`);
       } catch (err) {
           alert("Failed to load wallet.");
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
              status: 'COMPLETED'
          };
          await db.addTransaction(newTx);
          setWithdrawAmount('');
          setWithdrawPassword('');
          if (onRefresh) onRefresh();
          alert(`Successfully withdrew ${group.currency} ${amount} to your Mobile Money wallet.`);
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

  // --- EARLY RETURNS FOR GROUP STATUS ---

  if (currentUser.status === 'NEW') {
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
    const chartData = [
        { name: 'Jan', amount: 500 },
        { name: 'Feb', amount: 500 },
        { name: 'Mar', amount: 500 },
        { name: 'Apr', amount: 500 },
        { name: 'May', amount: 500 },
        { name: 'Jun', amount: 0 }, 
      ];
    
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
            title="Total Contributed"
            value={`${group.currency} ${totalContributed.toLocaleString()}`}
            icon={PiggyBank}
            color="bg-primary-600"
            />
            <StatsCard
            title="Next Payout Date"
            value={group.nextPayoutDate}
            trend="In 14 days"
            trendUp={true}
            icon={Calendar}
            color="bg-blue-600"
            />
            <StatsCard
            title="My Wallet Balance"
            value={`${group.currency} ${walletBalance.toLocaleString()}`}
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
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Contribution Overview</h3>
            </div>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#9ca3af" />
                    <YAxis hide />
                    <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1f2937', color: '#fff' }}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 5 ? '#e5e7eb' : '#10b981'} />
                        ))}
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center text-center">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
                    <Wallet className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Next Contribution</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Your next payment of <span className="font-bold text-gray-900 dark:text-white">{group.currency} {group.contributionAmount}</span> is due soon.</p>
                <button 
                    onClick={handlePayContribution}
                    disabled={isContributing}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                    {isContributing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Pay Now'}
                </button>
                <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Secure Transaction
                </p>
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
                          {members.map(member => (
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

  const renderTransactions = () => (
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
                    onClick={handlePayContribution}
                    disabled={isContributing}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-70"
                >
                    {isContributing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                    Make Contribution
                </button>
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
                        {userTransactions.length > 0 ? userTransactions.map(t => (
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
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{t.date}</td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                    {(t.type === 'PAYOUT' || t.type === 'DEPOSIT') ? '+' : '-'}{group.currency} {t.amount}
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
  );

  const renderWithdraw = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-xl p-6 text-white shadow-lg">
                <p className="text-purple-200 text-sm font-medium mb-1">Available to Withdraw</p>
                <h2 className="text-4xl font-bold mb-4">{group.currency} {walletBalance.toLocaleString()}</h2>
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ({group.currency})</label>
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
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {userTransactions.filter(t => t.type === 'WITHDRAWAL').map(tx => (
                                <tr key={tx.id}>
                                    <td className="px-6 py-4 text-gray-900 dark:text-white">{tx.date}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{group.currency} {tx.amount}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                            Completed
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {userTransactions.filter(t => t.type === 'WITHDRAWAL').length === 0 && (
                                <tr><td colSpan={3} className="p-6 text-center text-gray-500">No withdrawal history.</td></tr>
                            )}
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
                {group.payoutSchedule.map((memberId, index) => {
                    const member = members.find(m => m.id === memberId);
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
                                {group.currency} {group.totalPool.toLocaleString()}
                             </div>
                        </div>
                    );
                })}
          </div>
      </div>
  );

  const renderWalletModal = () => {
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile Money Number</label>
                      <div className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white font-mono flex items-center justify-between">
                          <span className="flex items-center gap-2">
                              <Smartphone className="w-4 h-4 text-gray-500" />
                              {currentUser.phoneNumber || 'N/A'} 
                          </span>
                          <span className="text-[10px] font-bold uppercase text-gray-400 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded">Registered</span>
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ({group.currency})</label>
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

  return (
    <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-700 gap-6">
            {[
                { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                { id: 'members', label: 'Members', icon: Users },
                { id: 'transactions', label: 'Transactions', icon: DollarSign },
                { id: 'withdraw', label: 'Withdraw', icon: Smartphone },
                { id: 'schedule', label: 'Schedule', icon: Calendar }
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
        </div>
        {renderWalletModal()}
    </div>
  );
};
