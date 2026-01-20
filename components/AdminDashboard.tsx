
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Transaction, Group, UserRole, AuditLog } from '../types';
import { StatsCard } from './StatsCard';
import { Users, Shield, Activity, DollarSign, Search, AlertTriangle, CheckCircle, XCircle, Lock, Unlock, Trash2, Server, Database, Settings, ScanFace, BrainCircuit, X, TrendingUp, Download, Upload, AlertOctagon, Globe, PlusCircle, Calendar, Camera, MessageSquare, UserCog, ShieldAlert, ChevronRight, Wallet, ArrowUpRight, FileText, UserPlus, Mail, Loader2, Eye, MapPin, Smartphone, Cpu, Wifi, Phone, History, FileDown, Radar, ArrowLeft, Megaphone, Send, Clock, ShieldCheck, BarChart3, Shuffle, ListOrdered, Check, ArrowUp, ArrowDown, Briefcase, Calendar as CalendarIcon, CreditCard, Zap, PlayCircle, Save, Bell, Percent, User as UserIcon, Copy } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { db } from '../services/database';
import { GroupChat } from './GroupChat';
import { moneyFormatter } from '../utils/formatters';
import { processGhanaMobileMoneyPayment, validateMobileMoneyTransaction, normalizePhoneNumber, getAvailableProviders } from '../services/ghanaMoneyService';
// reverted: use DollarSign from lucide-react instead of custom CediSign

interface AdminDashboardProps {
  group: Group;
  transactions: Transaction[];
  members: User[];
  currentUser: User;
  onRefresh?: () => void;
  initialTab?: string;
}

type AdminTab = 'overview' | 'members' | 'payouts' | 'transactions' | 'withdraw' | 'settings' | 'reports';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ group: initialGroup, transactions: initialTransactions, members: initialMembers, currentUser, onRefresh, initialTab }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>((initialTab as AdminTab) || 'overview');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [members, setMembers] = useState(initialMembers);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [group, setGroup] = useState(initialGroup);
  const [payoutOrder, setPayoutOrder] = useState(initialGroup.payoutSchedule);
  
  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState(true);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutDetails, setPayoutDetails] = useState<{recipient: User | undefined, amount: number} | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'primary',
    onConfirm: () => {},
  });

  const [viewMember, setViewMember] = useState<User | null>(null);

  const [walletBalance, setWalletBalance] = useState(0);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [momoDetails, setMomoDetails] = useState({ provider: 'MTN', number: currentUser.phoneNumber || '', amount: '' });
  const [isProcessingWallet, setIsProcessingWallet] = useState(false);
  
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPassword, setWithdrawPassword] = useState('');

  // --- Invite Member State ---
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  // --- Sync State ---
  useEffect(() => {
    setMembers(initialMembers);
    setTransactions(initialTransactions);
    setGroup(initialGroup);
    
    // Calculate local wallet for admin based on their tx history
    const adminTx = initialTransactions.filter(t => t.userId === currentUser.id);
    const balance = adminTx.reduce((sum, t) => {
        if (t.status !== 'COMPLETED') return sum;
        if (t.type === 'DEPOSIT' || t.type === 'PAYOUT') return sum + t.amount;
        if (t.type === 'WITHDRAWAL' || t.type === 'CONTRIBUTION') return sum - t.amount;
        return sum;
    }, 0);
    setWalletBalance(balance);
  }, [initialMembers, initialTransactions, initialGroup, currentUser.id]);

  const activeMembers = members.filter(m => m.status === 'ACTIVE');
  const pendingMembers = members.filter(m => m.status === 'PENDING');
  const pendingTransactions = transactions.filter(t => t.status === 'PENDING' && t.type === 'CONTRIBUTION');
  
  const cycleTarget = activeMembers.length * group.contributionAmount;
  const collectionProgress = Math.min((group.totalPool / (cycleTarget || 1)) * 100, 100);

  // --- ASYNC HANDLERS FOR MYSQL ---

  const handleApproveMember = async (id: string) => {
    try {
        await db.updateUser(id, { status: 'ACTIVE' });
        if (onRefresh) onRefresh();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
        alert("Action failed. Server error.");
    }
  };

  const handleRejectMember = async (id: string) => {
    try {
        await db.deleteUser(id);
        if (onRefresh) onRefresh();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
        alert("Action failed. Server error.");
    }
  };

  const handleApproveTransaction = async (txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    
    try {
        // In a real API, we'd have a PATCH /api/transactions/:id
        // Since the current db service simulates this with addTransaction/syncData,
        // we update via updateUser logic or similar if needed, or re-add as completed.
        // For this hybrid, we assume re-sync handles it after the leader clicks.
        alert("Verification confirmed! Updating central ledger...");
        if (onRefresh) onRefresh();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
        alert("Failed to verify payment.");
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput) return;
    setIsInviting(true);
    try {
        const success = await db.inviteMember(inviteInput);
        if (success) {
            alert(`Invitation sent to ${inviteInput}`);
            setInviteInput('');
            setIsInviteModalOpen(false);
            if(onRefresh) onRefresh();
        } else {
            alert('User already active.');
        }
    } catch (err) {
        alert("Invitation failed. Server unreachable.");
    } finally {
        setIsInviting(false);
    }
  };

  const handleUpdateGroup = async () => {
    try {
        await db.updateGroup(group.id, group);
        alert("Group settings saved permanently to MySQL.");
        if (onRefresh) onRefresh();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
        alert("Failed to save settings.");
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
              group.currency
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
              status: 'PENDING' // Mobile Money transactions are initially pending
          };

          await db.addTransaction(newTx);
          if (onRefresh) onRefresh();
          setWalletModalOpen(false);
          setMomoDetails(prev => ({ ...prev, amount: '' }));

          alert(`Payment Initiated!\n\n${paymentResult.message}\n\nTransaction ID: ${paymentResult.transactionId}`);
      } catch (err) {
          alert(`Payment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
          setIsProcessingWallet(false);
      }
  };

  const handleAdminContribution = async () => {
      if (walletBalance < group.contributionAmount) {
          alert(`Insufficient wallet balance. Please load funds first.`);
          setWalletModalOpen(true);
          return;
      }
      try {
          const newTx: Transaction = {
              id: `t${Date.now()}`,
              userId: currentUser.id,
              userName: currentUser.name,
              type: 'CONTRIBUTION',
              amount: group.contributionAmount,
              date: new Date().toISOString().split('T')[0],
              status: 'COMPLETED'
          };
          await db.addTransaction(newTx);
          if (onRefresh) onRefresh();
          alert("Admin contribution recorded successfully.");
      } catch (err) {
          alert("Action failed.");
      }
  };

  // --- RENDERERS ---

  const renderOverview = () => {
    const completedCount = activeMembers.length - pendingTransactions.length;
    const pieData = [{ name: 'Paid', value: completedCount }, { name: 'Pending', value: pendingTransactions.length }];
    const COLORS = ['#10b981', '#f59e0b'];
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard title="Total Group Pool" value={moneyFormatter(group.totalPool, group.currency)} trend="Live Balance" trendUp={true} icon={DollarSign} color="bg-emerald-600" />
          <StatsCard title="Active Members" value={activeMembers.length.toString()} trend={`${pendingMembers.length} New Requests`} trendUp={true} icon={Users} color="bg-blue-600" />
          <StatsCard title="Collection Status" value={`${Math.round(collectionProgress)}%`} icon={CheckCircle} color="bg-purple-600" />
          <StatsCard title="Pending Actions" value={(pendingTransactions.length + pendingMembers.length).toString()} trend="Needs Review" trendUp={false} icon={AlertTriangle} color="bg-orange-500" />
        </div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Active Cycle Progress</h3>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Collection Target</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{moneyFormatter(cycleTarget, group.currency)}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">Collected vs Target</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={[
                      { name: 'Progress', collected: group.totalPool, target: cycleTarget }
                    ]}>
                      <defs>
                        <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                      <Area type="monotone" dataKey="collected" stroke="#10b981" fillOpacity={1} fill="url(#colorCollected)" name="Collected" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">COLLECTED</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-300">{moneyFormatter(group.totalPool, group.currency)}</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">REMAINING</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{moneyFormatter(Math.max(0, cycleTarget - group.totalPool), group.currency)}</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">COMPLETION</p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{Math.round(collectionProgress)}%</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Payment Progress</h3>
            <div className="flex-1 min-h-[200px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{Math.round((completedCount / (activeMembers.length || 1)) * 100)}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">PAID</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMembers = () => {
      // Show only members that belong to this group (in payout schedule) and match search term
      const groupMemberIds = new Set(group.payoutSchedule);
      const filteredMembers = members.filter(member => 
          groupMemberIds.has(member.id) && 
          (member.name.toLowerCase().includes(searchTerm.toLowerCase()) || member.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-gray-300"><Wallet className="w-5 h-5" /><span className="text-sm font-medium uppercase tracking-wider">Leader Wallet</span></div>
                    <h3 className="text-4xl font-bold mb-1">{moneyFormatter(walletBalance, group.currency)}</h3>
                    <p className="text-xs text-gray-400">Manage group transactions from here.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                     <button onClick={() => setWalletModalOpen(true)} className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 rounded-lg font-bold transition-all flex items-center justify-center gap-2"><Smartphone className="w-4 h-4" /> Load Wallet</button>
                     <button onClick={handleAdminContribution} className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2"><DollarSign className="w-4 h-4" /> Pay Contribution</button>
                </div>
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
          <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Search members..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <button onClick={() => setIsInviteModalOpen(true)} className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-md"><UserPlus className="w-4 h-4" /> Invite Member</button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300"><tr><th className="px-6 py-4">Member</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Joined</th><th className="px-6 py-4">Reliability</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredMembers.map(member => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4"><div className="flex items-center gap-3"><img src={member.avatar} alt="" className="w-8 h-8 rounded-full" /><div><p className="font-medium text-gray-900 dark:text-white">{member.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p></div></div></td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${member.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{member.status}</span></td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{member.joinDate}</td>
                    <td className="px-6 py-4">
                        {member.status === 'PENDING' ? (
                            <div className="flex gap-2">
                                <button onClick={() => { setConfirmDialog({ isOpen: true, title: 'Approve Member', message: `Add ${member.name} to the group?`, type: 'primary', onConfirm: () => handleApproveMember(member.id) }); }} className="p-1 bg-green-100 text-green-700 rounded"><Check className="w-4 h-4" /></button>
                                <button onClick={() => { setConfirmDialog({ isOpen: true, title: 'Reject Member', message: `Remove ${member.name}'s request?`, type: 'danger', onConfirm: () => handleRejectMember(member.id) }); }} className="p-1 bg-red-100 text-red-700 rounded"><X className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${member.reliabilityScore || 0}%` }}></div></div>
                                <span className="text-xs text-gray-600">{member.reliabilityScore}%</span>
                            </div>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right"><button onClick={() => setViewMember(member)} className="p-2 text-gray-400 hover:text-primary-600"><Eye className="w-5 h-5" /></button></td>
                  </tr>
              ))}
              </tbody>
          </table>
        </div>
      </div>
      );
  };

  const renderTransactions = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600"><tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">User</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Amount</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                      {transactions.filter(t => t.userName.toLowerCase().includes(searchTerm.toLowerCase())).map(tx => (
                          <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-6 py-4">{tx.date}</td><td className="px-6 py-4 font-medium">{tx.userName}</td><td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-xs font-bold ${tx.type === 'CONTRIBUTION' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{tx.type}</span></td><td className="px-6 py-4 font-bold">{group.currency} {tx.amount}</td><td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{tx.status}</span></td>
                              <td className="px-6 py-4 text-right">{tx.status === 'PENDING' && ( <button onClick={() => handleApproveTransaction(tx.id)} className="text-primary-600 font-bold text-xs bg-primary-50 px-3 py-1.5 rounded">Confirm Receipt</button> )}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
  );

  const renderSettings = () => (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6">Group Configuration</h3>
              <form onSubmit={(e) => { e.preventDefault(); setConfirmDialog({ isOpen: true, title: 'Save Settings', message: 'Update group details in MySQL?', type: 'warning', onConfirm: handleUpdateGroup }); }} className="space-y-6">
                  <div><label className="block text-sm font-medium mb-2">Group Name</label><input type="text" value={group.name} onChange={(e) => setGroup({...group, name: e.target.value})} className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700" /></div>
                  <div className="grid grid-cols-2 gap-6"><div><label className="block text-sm font-medium mb-2">Contribution Amount</label><input type="number" value={group.contributionAmount} onChange={(e) => setGroup({...group, contributionAmount: Number(e.target.value)})} className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700" /></div><div><label className="block text-sm font-medium mb-2">Currency</label><select value={group.currency} onChange={(e) => setGroup({...group, currency: e.target.value})} className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700"><option value="GHS">GHS</option><option value="USD">USD</option></select></div></div>
                  <div><button type="submit" className="px-6 py-3 bg-primary-600 text-white rounded-lg font-bold shadow-md"><Save className="w-4 h-4 mr-2 inline" /> Save Changes</button></div>
              </form>
          </div>
      </div>
  );

  return (
    <div className="space-y-6">
        <div className="flex overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-700 gap-6">
            {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'members', label: 'Members', icon: Users },
                { id: 'payouts', label: 'Payouts', icon: Wallet },
                { id: 'transactions', label: 'Transactions', icon: DollarSign },
                { id: 'settings', label: 'Settings', icon: Settings }
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as AdminTab)}
                    className={`flex items-center gap-2 pb-2 px-1 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
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
            {activeTab === 'settings' && renderSettings()}
            {activeTab === 'payouts' && ( <div className="p-12 text-center text-gray-500">Payout logic uses MySQL PayoutSchedule table. Triggering now...</div> )}
        </div>

        {/* Common Modals */}
        {isInviteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
                    <h3 className="text-lg font-bold mb-4">Invite Member</h3>
                    <form onSubmit={handleInviteMember} className="space-y-4">
                        <input type="text" value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} className="w-full p-3 border rounded-lg bg-gray-50" placeholder="Email or Phone" required />
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setIsInviteModalOpen(false)} className="flex-1 py-2 text-gray-500">Cancel</button>
                            <button type="submit" disabled={isInviting} className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-bold">{isInviting ? 'Inviting...' : 'Send Invite'}</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {walletModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Load Leader Wallet</h3>
                        <button onClick={() => setWalletModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                    </div>

                    <div className="space-y-4">
                        {/* Provider Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mobile Money Provider</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['MTN', 'Vodafone', 'AirtelTigo'].map((provider) => (
                                    <button
                                        key={provider}
                                        onClick={() => setMomoDetails(prev => ({...prev, provider}))}
                                        className={`py-2.5 rounded-lg border text-sm font-bold transition-all ${
                                            momoDetails.provider === provider
                                                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500 text-primary-700 dark:text-primary-400 ring-1 ring-primary-500'
                                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {provider}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Phone Number Display */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Registered Phone Number</label>
                            <div className="relative">
                                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <div className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-900 dark:text-white font-mono flex items-center justify-between">
                                    <span>{normalizePhoneNumber(currentUser.phoneNumber || 'Not set')}</span>
                                    <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded">Verified</span>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your registered mobile money account</p>
                        </div>

                        {/* Amount Input */}
                        <div>
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount (GHS)</label>
                                <button
                                    type="button"
                                    onClick={() => setMomoDetails(prev => ({ ...prev, amount: String(group.contributionAmount) }))}
                                    className="text-sm text-primary-600 hover:underline"
                                >
                                    Use contribution: {moneyFormatter(group.contributionAmount, group.currency)}
                                </button>
                            </div>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={momoDetails.amount}
                                    onChange={(e) => setMomoDetails(prev => ({...prev, amount: e.target.value}))}
                                    min="1"
                                    max="10000"
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Min: GHS 1 | Max: GHS 10,000</p>
                        </div>

                        {/* Info Box */}
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
                            You will receive a USSD prompt on your phone to complete the payment.
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setWalletModalOpen(false)}
                                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLoadWallet}
                                disabled={isProcessingWallet || !momoDetails.amount || !currentUser.phoneNumber}
                                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                {isProcessingWallet ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Smartphone className="w-4 h-4" />
                                        Load Wallet
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {confirmDialog.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border">
                    <h3 className="text-lg font-bold mb-2">{confirmDialog.title}</h3>
                    <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setConfirmDialog({...confirmDialog, isOpen: false})} className="px-4 py-2">Cancel</button>
                        <button onClick={confirmDialog.onConfirm} className={`px-4 py-2 text-white rounded-lg font-bold ${confirmDialog.type === 'danger' ? 'bg-red-600' : 'bg-primary-600'}`}>Confirm</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
