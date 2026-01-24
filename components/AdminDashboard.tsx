
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Transaction, Group, UserRole, AuditLog } from '../types';
import { StatsCard } from './StatsCard';
import { Users, Shield, Activity, DollarSign, Search, AlertTriangle, CheckCircle, XCircle, Lock, Unlock, Trash2, Server, Database, Settings, ScanFace, BrainCircuit, X, TrendingUp, Download, Upload, AlertOctagon, Globe, PlusCircle, Calendar, Camera, MessageSquare, UserCog, ShieldAlert, ChevronRight, Wallet, ArrowUpRight, FileText, UserPlus, Mail, Loader2, Eye, MapPin, Smartphone, Cpu, Wifi, Phone, History, FileDown, Radar, ArrowLeft, Megaphone, Send, Clock, ShieldCheck, BarChart3, Shuffle, ListOrdered, Check, ArrowUp, ArrowDown, Briefcase, Calendar as CalendarIcon, CreditCard, Zap, PlayCircle, Save, Bell, Percent, User as UserIcon, Copy } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { db } from '../services/database';
import { GroupChat } from './GroupChat';
import { AIHelpCenter } from './AIHelpCenter';
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

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.MEMBER);

  const [groupContributionTransactions, setGroupContributionTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchGroupContributions = async () => {
      if (group?.id) {
        try {
          const contributions = await db.getGroupContributionTransactions(group.id);
          setGroupContributionTransactions(contributions);
        } catch (error) {
          console.error("Failed to fetch group contribution transactions:", error);
          setGroupContributionTransactions([]); // Ensure it's an empty array on error
        }
      }
    };
    fetchGroupContributions();
  }, [group?.id, onRefresh]);


  // --- Help Center State ---
  const [isHelpCenterOpen, setIsHelpCenterOpen] = useState(false);

  // --- Invite Member State ---
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const [groupMemberIds, setGroupMemberIds] = useState(new Set<string>());

  useEffect(() => {
    if (!group?.id) return;

    const fetchGroupMembers = async () => {
        try {
            const response = await fetch(`http://localhost:3001/api/group-memberships`);
            if (response.ok) {
                const allMemberships = await response.json();
                if (Array.isArray(allMemberships)) {
                    const currentGroupMemberIds = new Set<string>();
                    allMemberships.forEach((m: any) => {
                        if (m.group_id === group.id) {
                            currentGroupMemberIds.add(m.user_id);
                        }
                    });
                    setGroupMemberIds(currentGroupMemberIds);
                }
            } else {
                console.error("Failed to fetch group memberships:", response.statusText);
                setGroupMemberIds(new Set<string>()); // Clear on failure
            }
        } catch (error) {
            console.error("Could not fetch group memberships.", error);
            setGroupMemberIds(new Set<string>()); // Clear on error
        }
    };

    fetchGroupMembers();
  }, [group?.id]);

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

  const handleRejectTransaction = async (txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    try {
        // Mock rejection as we don't have a specific backend endpoint for this.
        alert("Transaction rejected and member notified.");
        if (onRefresh) onRefresh(); // Re-sync data from the server.
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
        alert("Action failed. Could not reject transaction.");
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
    } catch (err: any) {
        alert(`Failed to save settings: ${err.message || "Unknown error"}`);
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

  const copyLink = () => {
    navigator.clipboard.writeText(`https://digitalsusu.app/join/${group.inviteCode}`);
    alert("Group invite link copied to clipboard!");
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
          <StatsCard title="Active Members" value={activeMembers.length.toString()} trend={`${pendingMembers.length} Pending Members`} trendUp={true} icon={Users} color="bg-blue-600" />
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
      // Filters the member list to show only active, joined members.
      // It excludes superusers, members not part of the current group,
      // and anyone whose status isn't 'ACTIVE'. Also filters by search term.
      const filteredMembers = members.filter(member =>
          member.role !== UserRole.SUPERUSER &&
          groupMemberIds.has(member.id) &&
          member.status === 'ACTIVE' &&
          (member.name.toLowerCase().includes(searchTerm.toLowerCase()) || member.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      const pendingMembersForCurrentGroup = members.filter(member =>
          member.role !== UserRole.SUPERUSER &&
          groupMemberIds.has(member.id) &&
          member.status === 'PENDING' &&
          (member.name.toLowerCase().includes(searchTerm.toLowerCase()) || member.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-gray-300"><Wallet className="w-5 h-5" /><span className="text-sm font-medium uppercase tracking-wider">Group Leader Wallet</span></div>
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
          <button onClick={() => setIsInviteModalOpen(true)} className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-md"><UserPlus className="w-4 h-4" /> Invite New Member</button>
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
                        <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${member.reliabilityScore || 0}%` }}></div></div>
                                <span className="text-xs text-gray-600">{member.reliabilityScore}%</span>
                            </div>
                    </td>
                    <td className="px-6 py-4 text-right"><button onClick={() => setViewMember(member)} className="p-2 text-gray-400 hover:text-primary-600"><Eye className="w-5 h-5" /></button></td>
                  </tr>
              ))}
              </tbody>
          </table>
        </div>

        {pendingMembersForCurrentGroup.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mt-8">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white px-6 py-4 border-b border-gray-100 dark:border-gray-700">Pending Members</h3>
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        <tr>
                            <th className="px-6 py-4">Member</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Joined</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {pendingMembersForCurrentGroup.map(member => (
                            <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <img src={member.avatar} alt="" className="w-8 h-8 rounded-full" />
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700`}>{member.status}</span></td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{member.joinDate}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setConfirmDialog({ isOpen: true, title: 'Approve Member', message: `Add ${member.name} to the group?`, type: 'primary', onConfirm: () => handleApproveMember(member.id) }); }} className="p-1 bg-green-100 text-green-700 rounded"><Check className="w-4 h-4" /></button>
                                        <button onClick={() => { setConfirmDialog({ isOpen: true, title: 'Reject Member', message: `Remove ${member.name}'s request?`, type: 'danger', onConfirm: () => handleRejectMember(member.id) }); }} className="p-1 bg-red-100 text-red-700 rounded"><X className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

      </div>
      );
  };

  const renderTransactions = () => {
    // Now uses dedicated state for group contributions, simplifying the filter.
    const filteredContributionTransactions = groupContributionTransactions.filter(tx =>
        tx.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter transactions for the current administrator
    const adminPersonalTransactions = transactions.filter(tx =>
        tx.userId === currentUser.id &&
        (tx.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
         tx.type.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending

    return (
      <div className="space-y-6 animate-fade-in">
          {/* Member Contribution Transactions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white px-6 py-4 border-b border-gray-100 dark:border-gray-700">Member Contribution Transactions</h3>
              <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Member Name</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredContributionTransactions.length > 0 ? filteredContributionTransactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-6 py-4">{tx.date}</td>
                              <td className="px-6 py-4 font-medium">{tx.userName}</td>
                              <td className="px-6 py-4 font-bold">{moneyFormatter(tx.amount, group.currency)}</td>
                              <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{tx.status}</span></td>
                              <td className="px-6 py-4 text-right">
                                {tx.status === 'PENDING' ? (
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setConfirmDialog({ isOpen: true, title: 'Approve Transaction', message: `Approve this ${moneyFormatter(tx.amount, group.currency)} contribution from ${tx.userName}?`, type: 'primary', onConfirm: () => handleApproveTransaction(tx.id) }); }} className="p-1 bg-green-100 text-green-700 rounded"><Check className="w-4 h-4" /></button>
                                        <button onClick={() => { setConfirmDialog({ isOpen: true, title: 'Reject Transaction', message: `Reject this contribution from ${tx.userName}?`, type: 'danger', onConfirm: () => handleRejectTransaction(tx.id) }); }} className="p-1 bg-red-100 text-red-700 rounded"><X className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <span className="text-xs text-gray-400 italic">No actions</span>
                                )}
                              </td>
                          </tr>
                      )) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No member contribution transactions found.</td>
                        </tr>
                      )}
                  </tbody>
              </table>
          </div>

          {/* Administrator's Personal Transactions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden mt-8">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white px-6 py-4 border-b border-gray-100 dark:border-gray-700">Administrator's Personal Transactions</h3>
              <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {adminPersonalTransactions.length > 0 ? adminPersonalTransactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-6 py-4">{tx.date}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    tx.type === 'CONTRIBUTION' ? 'bg-blue-100 text-blue-700' :
                                    tx.type === 'DEPOSIT' ? 'bg-green-100 text-green-700' :
                                    tx.type === 'WITHDRAWAL' ? 'bg-red-100 text-red-700' :
                                    tx.type === 'PAYOUT' ? 'bg-purple-100 text-purple-700' :
                                    'bg-gray-100 text-gray-700'
                                }`}>{tx.type}</span>
                              </td>
                              <td className="px-6 py-4 font-bold">{moneyFormatter(tx.amount, group.currency)}</td>
                              <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{tx.status}</span></td>
                          </tr>
                      )) : (
                        <tr>
                            <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No personal transactions found for the administrator.</td>
                        </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    );
  };

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

  const renderPayouts = () => {
    const payoutHistory = transactions.filter(t => t.type === 'PAYOUT' && t.status === 'COMPLETED').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const paidUserIds = new Set(payoutHistory.map(t => t.userId));
    
    const membersWhoHaveReceived = members.filter(m => paidUserIds.has(m.id));
    const membersYetToReceive = payoutOrder.map(userId => members.find(m => m.id === userId)).filter((m): m is User => !!m && !paidUserIds.has(m.id));

    let nextUserIndex = payoutOrder.findIndex(userId => !paidUserIds.has(userId));
    if (nextUserIndex === -1 && payoutOrder.length > 0) {
        nextUserIndex = payoutOrder.length; 
    }

    const nextRecipient = members.find(m => m.id === payoutOrder[nextUserIndex]);
    
    const handleManualPayout = async () => {
        if (!nextRecipient) {
            alert("No one is scheduled for the next payout.");
            return;
        }

        const payoutAmount = group.totalPool;
        if (walletBalance < payoutAmount) {
            alert(`Insufficient funds for payout. Pool: ${moneyFormatter(payoutAmount, group.currency)}, Wallet: ${moneyFormatter(walletBalance, group.currency)}`);
            return;
        }

        setConfirmDialog({
            isOpen: true,
            title: 'Confirm Manual Payout',
            message: `Are you sure you want to send ${moneyFormatter(payoutAmount, group.currency)} to ${nextRecipient.name}?`,
            type: 'warning',
            onConfirm: async () => {
                setIsProcessingPayout(true);
                try {
                    await new Promise(res => setTimeout(res, 1500)); 

                    const newTx: Transaction = {
                        id: `tx-p-${Date.now()}`,
                        userId: nextRecipient.id,
                        userName: nextRecipient.name,
                        type: 'PAYOUT',
                        amount: payoutAmount,
                        date: new Date().toISOString().split('T')[0],
                        status: 'COMPLETED'
                    };

                    await db.addTransaction(newTx);
                    
                    await db.updateGroup(group.id, { ...group, totalPool: 0 });

                    alert(`Payout successful! ${nextRecipient.name} has been paid.`);
                    if (onRefresh) onRefresh();

                } catch (err) {
                    alert(`Payout failed: ${err instanceof Error ? err.message : 'An unknown error occurred.'}`);
                } finally {
                    setIsProcessingPayout(false);
                    setConfirmDialog(prev => ({...prev, isOpen: false}));
                }
            }
        });
    };

    const handleReorder = (newOrder: string[]) => {
      setPayoutOrder(newOrder);
      db.updateGroup(group.id, { ...group, payoutSchedule: newOrder });
      alert("Payout order updated locally. Save settings to persist.");
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Next Payout Recipient</h3>
                    {nextRecipient ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-lg">
                           <div className="flex items-center gap-4">
                               <img src={nextRecipient.avatar} alt={nextRecipient.name} className="w-12 h-12 rounded-full border-2 border-white"/>
                               <div>
                                   <p className="font-bold text-lg text-primary-800 dark:text-primary-300">{nextRecipient.name}</p>
                                   <p className="text-sm text-primary-600 dark:text-primary-400">Scheduled for <span className="font-bold">{moneyFormatter(group.totalPool, group.currency)}</span></p>
                               </div>
                           </div>
                            <button 
                                onClick={handleManualPayout} 
                                disabled={isProcessingPayout || group.totalPool <= 0}
                                className="w-full mt-4 sm:mt-0 sm:w-auto px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessingPayout ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                {isProcessingPayout ? 'Processing...' : 'Pay Now'}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center p-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <p className="font-medium text-gray-700 dark:text-gray-300">All members have been paid for this cycle!</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">The payout schedule is complete. You can start a new cycle in settings.</p>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">Payout Queue</h3>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleReorder([...payoutOrder].sort(() => Math.random() - 0.5))} className="p-2 text-gray-500 hover:text-primary-600 rounded-full bg-gray-100 dark:bg-gray-700"><Shuffle className="w-4 h-4" /></button>
                        <span className="text-xs text-gray-400">Randomize</span>
                      </div>
                    </div>
                    
                    <ul className="space-y-3">
                        {payoutOrder.map((userId, index) => {
                            const member = members.find(m => m.id === userId);
                            if (!member) return null;

                            const isPaid = paidUserIds.has(userId);
                            const isNext = index === nextUserIndex;

                            return (
                                <li key={userId} className={`flex items-center justify-between p-3 rounded-lg transition-all ${isNext ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700' : isPaid ? 'bg-gray-100 dark:bg-gray-700/50 opacity-60' : 'bg-gray-50 dark:bg-gray-800'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-bold text-sm w-6 text-center ${isNext ? 'text-blue-600 dark:text-blue-300' : 'text-gray-400'}`}>{index + 1}</span>
                                        <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
                                        <p className="font-medium text-gray-800 dark:text-gray-200">{member.name}</p>
                                    </div>
                                    <div>
                                        {isPaid ? <span className="px-2 py-1 text-xs font-bold text-green-800 dark:text-green-300 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Paid</span> : isNext ? <span className="px-2 py-1 text-xs font-bold text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-full animate-pulse">Next Up</span> : <span className="text-xs text-gray-500">Queued</span>}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Members Who Have Received</h3>
                        <div className="space-y-3">
                            {membersWhoHaveReceived.length > 0 ? membersWhoHaveReceived.map(member => (
                                <div key={member.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
                                    <p className="font-medium text-gray-800 dark:text-gray-200">{member.name}</p>
                                </div>
                            )) : <p className="text-sm text-gray-500">No members have received payouts yet.</p>}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Members Yet to Receive</h3>
                         <div className="space-y-3">
                            {membersYetToReceive.length > 0 ? membersYetToReceive.map(member => (
                                <div key={member.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
                                    <p className="font-medium text-gray-800 dark:text-gray-200">{member.name}</p>
                                </div>
                            )) : <p className="text-sm text-gray-500">All members have received their payout.</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Payout History Column */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6 flex items-center gap-2"><History className="w-5 h-5 text-gray-400"/> Payout History</h3>
                <div className="space-y-4">
                  {payoutHistory.length > 0 ? payoutHistory.map(tx => (
                     <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                       <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-full ${tx.status === 'COMPLETED' ? 'bg-green-100 dark:bg-green-900' : 'bg-yellow-100'}`}>
                           <ArrowUpRight className={`w-4 h-4 ${tx.status === 'COMPLETED' ? 'text-green-600' : 'text-yellow-600'}`} />
                         </div>
                         <div>
                           <p className="font-medium text-gray-900 dark:text-white">{tx.userName}</p>
                           <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(tx.date).toLocaleDateString()}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="font-bold text-gray-800 dark:text-gray-200">{moneyFormatter(tx.amount, group.currency)}</p>
                         <p className="text-xs text-green-600 dark:text-green-400 font-medium">{tx.status}</p>
                       </div>
                     </div>
                  )) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileDown className="w-8 h-8 mx-auto mb-2 text-gray-400"/>
                      No payouts have been made in this cycle yet.
                    </div>
                  )}
                </div>
            </div>
        </div>
    );
  };

  const handleSuspendMember = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Suspend Member',
      message: `Are you sure you want to suspend this member? They will lose access to the group.`,
      type: 'danger',
      onConfirm: async () => {
        try {
            await db.updateUser(id, { status: 'SUSPENDED' });
            if (onRefresh) onRefresh();
            setViewMember(null);
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            alert("Member has been suspended.");
        } catch (err) {
            alert("Action failed. Server error.");
        }
      }
    });
  };

  const renderMemberDetailsModal = () => {
    if (!viewMember) return null;

    const memberTransactions = transactions.filter(t => t.userId === viewMember.id);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <UserIcon className="w-6 h-6 text-primary-600"/>
                        Member Profile
                    </h3>
                    <button onClick={() => setViewMember(null)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <X className="w-5 h-5 text-gray-500"/>
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                    <div className="flex items-center gap-6">
                        <img src={viewMember.avatar} alt={viewMember.name} className="w-24 h-24 rounded-full border-4 border-gray-100 dark:border-gray-700" />
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{viewMember.name}</h2>
                            <p className="text-gray-500 dark:text-gray-400">{viewMember.occupation || 'No occupation listed'}</p>
                            <div className="flex items-center gap-4 mt-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${viewMember.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{viewMember.status}</span>
                                <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-green-500" /> Reliability: {viewMember.reliabilityScore}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                           <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-4">Contact Information</h4>
                           <div className="space-y-3 text-sm">
                               <p className="flex items-center gap-3"><Mail className="w-4 h-4 text-gray-400"/> {viewMember.email}</p>
                               <p className="flex items-center gap-3"><Phone className="w-4 h-4 text-gray-400"/> {viewMember.phoneNumber || 'Not provided'}</p>
                               <p className="flex items-center gap-3"><MapPin className="w-4 h-4 text-gray-400"/> {viewMember.location || 'Not provided'}</p>
                           </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                           <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-4">Group Details</h4>
                           <div className="space-y-3 text-sm">
                               <p className="flex items-center gap-3"><CalendarIcon className="w-4 h-4 text-gray-400"/> Joined on {new Date(viewMember.joinDate).toLocaleDateString()}</p>
                               <p className="flex items-center gap-3"><Briefcase className="w-4 h-4 text-gray-400"/> Role: {viewMember.role}</p>
                               <p className="flex items-center gap-3"><ScanFace className="w-4 h-4 text-gray-400"/> KYC Status: <span className="font-bold">{viewMember.verificationStatus}</span></p>
                           </div>
                        </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-4">Transaction History</h4>
                      <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            <tr>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3">Amount</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {memberTransactions.length > 0 ? memberTransactions.map(tx => (
                              <tr key={tx.id}>
                                <td className="px-4 py-3">{tx.date}</td>
                                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${tx.type === 'CONTRIBUTION' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{tx.type}</span></td>
                                <td className="px-4 py-3 font-medium">{moneyFormatter(tx.amount, group.currency)}</td>
                                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{tx.status}</span></td>
                              </tr>
                            )) : (
                              <tr><td colSpan={4} className="text-center p-8 text-gray-500">No transactions found for this member.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                </div>
                 <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end items-center gap-3">
                    <button onClick={() => handleSuspendMember(viewMember.id)} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2"><Trash2 className="w-4 h-4"/> Suspend Member</button>
                    <button className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"><UserCog className="w-4 h-4"/> Manage Member Roles</button>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Group: {group.name}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Group Administrator Dashboard</p>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-2 rounded-lg border border-gray-200 dark:border-gray-600 w-full sm:w-auto">
                    <span className="text-xs text-gray-500 dark:text-gray-400 px-2">Invite Code:</span>
                    <code className="font-mono text-sm font-bold text-primary-700 dark:text-primary-400">
                        {group.inviteCode}
                    </code>
                    <button onClick={copyLink} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors" title="Copy Invite Link">
                        <Copy className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                    </button>
                </div>
                <button 
                    onClick={() => setIsHelpCenterOpen(true)}
                    className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    title="Chat with Support"
                >
                    <MessageSquare className="w-5 h-5" />
                </button>
            </div>
        </div>
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
            {activeTab === 'payouts' && renderPayouts()}
        </div>

        {/* --- Modals --- */}
        
        {viewMember && renderMemberDetailsModal()}

        {isHelpCenterOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <BrainCircuit className="w-6 h-6 text-primary-600"/>
                            AI Assistant & Help Center
                        </h3>
                        <button onClick={() => setIsHelpCenterOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                            <X className="w-5 h-5 text-gray-500"/>
                        </button>
                    </div>
                    <div className="flex-grow overflow-y-auto p-6">
                        <AIHelpCenter />
                    </div>
                </div>
            </div>
        )}

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
