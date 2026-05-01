
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Transaction, Group, UserRole, AuditLog } from '../types';
import { StatsCard } from './StatsCard';
import { Users, Shield, Activity, DollarSign, Search, AlertTriangle, CheckCircle, XCircle, Lock, Unlock, Trash2, Server, Database, Settings, ScanFace, BrainCircuit, X, TrendingUp, Download, Upload, AlertOctagon, Globe, PlusCircle, Calendar, Camera, MessageSquare, UserCog, ShieldAlert, ChevronRight, Wallet, ArrowUpRight, FileText, UserPlus, Mail, Loader2, Eye, MapPin, Smartphone, Cpu, Wifi, Phone, History, FileDown, Radar, ArrowLeft, Megaphone, Send, Clock, ShieldCheck, BarChart3, Shuffle, ListOrdered, Check, ArrowUp, ArrowDown, Briefcase, Calendar as CalendarIcon, CreditCard, Zap, PlayCircle, Save, Bell, Percent, User as UserIcon, Copy, RotateCcw, Video, PhoneIncoming } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { db } from '../services/database';
import { GroupChat } from './GroupChat';
import { AIHelpCenter } from './AIHelpCenter';
import { moneyFormatter } from '../utils/formatters';
import { processGhanaMobileMoneyPayment, validateMobileMoneyTransaction, normalizePhoneNumber, getAvailableProviders } from '../services/ghanaMoneyService';
import { initializePaystackPayment } from '../services/paystackService';
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
  
  const totalPoolNumber = useMemo(() => Number(group?.totalPool || 0), [group?.totalPool]);

  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState(true);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutDetails, setPayoutDetails] = useState<{recipient: User | undefined, amount: number} | null>(null);

  const [isSplitPayoutModalOpen, setIsSplitPayoutModalOpen] = useState(false);
  const [selectedMembersForPayout, setSelectedMembersForPayout] = useState<string[]>([]);
  const [isProcessingSplitPayout, setIsProcessingSplitPayout] = useState(false);
  const [payoutAmounts, setPayoutAmounts] = useState<{ [key: string]: string }>({});

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
  
  // Withdrawal State
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawRequestAmount, setWithdrawRequestAmount] = useState('');
  const [isRequestingWithdrawal, setIsRequestingWithdrawal] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPassword, setWithdrawPassword] = useState('');

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.MEMBER);

  const [isStartingNewCycle, setIsStartingNewCycle] = useState(false);

  const [groupContributionTransactions, setGroupContributionTransactions] = useState<Transaction[]>([]);
  const [currentCyclePayoutHistory, setCurrentCyclePayoutHistory] = useState<Transaction[]>([]);
  const [allTimePayoutHistory, setAllTimePayoutHistory] = useState<Transaction[]>([]);
  const [groupMemberships, setGroupMemberships] = useState<Record<string, string>>({});

  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);

  // --- Transaction Filter & Sort State ---
  const [txSortOrder, setTxSortOrder] = useState<'asc' | 'desc'>('desc');
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');

  // --- Derived State for Payout Cycle ---
  const activeMembersInCycle = useMemo(() => 
      members.filter(m => 
        groupMemberships[m.id] === 'ACTIVE' && 
        m.status !== 'SUSPENDED' && 
        m.role !== UserRole.SUPERUSER
      ),
      [members, groupMemberships]
  );

  const paidUserIds = useMemo(() => 
      new Set(currentCyclePayoutHistory.map(t => t.userId)),
      [currentCyclePayoutHistory]
  );

  const isPayoutCycleComplete = useMemo(() => 
      activeMembersInCycle.length > 0 && activeMembersInCycle.every(m => paidUserIds.has(m.id)),
      [activeMembersInCycle, paidUserIds]
  );

  useEffect(() => {
    if (!group?.id) return;

    const fetchGroupMembers = async () => {
        try {
            const token = localStorage.getItem('susu_jwt_token');
            const response = await fetch(`/api/group-memberships`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const allMemberships = await response.json();
                if (Array.isArray(allMemberships)) {
                    const memberships: Record<string, string> = {};
                    allMemberships.forEach((m: any) => {
                        if (m.group_id === group.id) {
                            memberships[m.user_id] = m.status;
                        }
                    });
                    setGroupMemberships(memberships);
                }
            } else {
                console.error("Failed to fetch group memberships:", response.statusText);
                setGroupMemberships({}); // Clear on failure
            }
        } catch (error) {
            console.error("Could not fetch group memberships.", error);
            setGroupMemberships({}); // Clear on error
        }
    };

    fetchGroupMembers();
  }, [group?.id, members]);

  useEffect(() => {
    const fetchPayoutHistory = async () => {
      if (group?.id) {
        try {
          // Fetch ALL historical payouts (Backend no longer deletes them)
          const allPayouts = await db.getGroupPayoutTransactions(group.id);
          
          // 1. Payout History Tab: Always show everything
          setAllTimePayoutHistory(allPayouts);

          // 2. Active Cycle Logic: Filter for payouts in the current cycle only
          if (group.cycleStartDate) {
            const cycleStart = new Date(group.cycleStartDate);

            const currentPayouts = allPayouts.filter(t => {
              const txDate = new Date(t.date);
              return txDate.getTime() >= cycleStart.getTime();
            });
            setCurrentCyclePayoutHistory(currentPayouts);
          } else {
            // Fallback for legacy groups or first run
            setCurrentCyclePayoutHistory(allPayouts);
          }

        } catch (error) {
          console.error("Failed to fetch payout history:", error);
          setCurrentCyclePayoutHistory([]);
          setAllTimePayoutHistory([]);
        }
      }
    };
    fetchPayoutHistory();
  }, [group?.id, group?.cycleStartDate, group?.totalPool, onRefresh]);

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

  const renderVideoCallModal = () => {
      if (!isVideoCallOpen) return null;
      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
              <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[80vh] border border-gray-800 relative">
                  <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-white text-xs font-bold">LIVE</span>
                  </div>
                  <button onClick={() => setIsVideoCallOpen(false)} className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors">
                      <X className="w-6 h-6" />
                  </button>
                  
                  <div className="flex-1 relative bg-black flex items-center justify-center">
                      <div className="text-center">
                          <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-gray-700 relative">
                              <UserIcon className="w-16 h-16 text-gray-400" />
                              <div className="absolute bottom-0 right-0 p-2 bg-green-500 rounded-full border-4 border-gray-800"></div>
                          </div>
                          <h3 className="text-3xl font-bold text-white mb-2">Superuser</h3>
                          <p className="text-gray-400 text-lg">Incoming Video Call...</p>
                      </div>
                      
                      {/* Local Stream Preview */}
                      <div className="absolute bottom-6 right-6 w-48 h-36 bg-gray-800 rounded-xl border-2 border-gray-700 overflow-hidden shadow-2xl flex items-center justify-center">
                          <Camera className="w-8 h-8 text-gray-500" />
                      </div>
                  </div>

                  <div className="p-8 bg-gray-800 flex justify-center items-center gap-12 border-t border-gray-700">
                      <button onClick={() => setIsVideoCallOpen(false)} className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg hover:scale-110">
                          <Phone className="w-8 h-8 rotate-[135deg]" />
                      </button>
                      <button onClick={() => alert("Call Accepted")} className="p-4 rounded-full bg-green-600 hover:bg-green-700 text-white transition-all shadow-lg hover:scale-110 animate-pulse">
                          <Phone className="w-8 h-8" />
                      </button>
                  </div>
              </div>
          </div>
      );
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
          
          await initializePaystackPayment({
              email: currentUser.email,
              amount: amount,
              currency: group.currency,
              metadata: {
                  userId: currentUser.id,
                  type: 'WALLET_LOAD'
              },
              onSuccess: async (reference) => {
                  const newTx: Transaction = {
                      id: reference,
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
                  setMomoDetails(prev => ({ ...prev, amount: '' }));
                  alert(`Wallet loaded successfully! Ref: ${reference}`);
              },
              onClose: () => setIsProcessingWallet(false)
          });
      } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          alert(`Payment failed: ${errorMessage}`);
      } finally {
          setIsProcessingWallet(false);
      }
  };

  const handleRequestWithdrawal = async () => {
      if (!withdrawRequestAmount) {
          alert('Please enter an amount.');
          return;
      }
      
      const amount = Number(withdrawRequestAmount);
      if (isNaN(amount) || amount <= 0) {
          alert('Please enter a valid amount greater than zero.');
          return;
      }

      if (amount > walletBalance) {
          alert(`Insufficient wallet balance. Available: ${moneyFormatter(walletBalance, group.currency)}`);
          return;
      }

      // Security: Ensure phone number is present and valid from profile (not user input)
      if (!currentUser.phoneNumber) {
          alert('No registered phone number found. Please update your profile settings first.');
          return;
      }

      setIsRequestingWithdrawal(true);
      try {
          // Security: Create transaction with PENDING status.
          // Backend/Superuser must approve this before actual money movement.
          const newTx: Transaction = {
              id: `tx-w-req-${Date.now()}`,
              userId: currentUser.id,
              userName: currentUser.name,
              type: 'WITHDRAWAL',
              amount: amount,
              date: new Date().toISOString().split('T')[0],
              status: 'PENDING' // Enforce approval workflow
          };

          await db.addTransaction(newTx);
          // Notify Superuser of withdrawal request
          const superuser = members.find(m => m.role === UserRole.SUPERUSER);
          if (superuser) {
              await db.createNotification({
                  id: `notif-wd-req-${Date.now()}`, recipientId: superuser.id,
                  title: 'Withdrawal Request',
                  message: `${currentUser.name} has requested to withdraw ${moneyFormatter(amount, group.currency)}.`,
                  type: 'warning', timestamp: Date.now(), read: false
              });
          }
          
          if (onRefresh) onRefresh();
          setWithdrawModalOpen(false);
          setWithdrawRequestAmount('');
          alert("Withdrawal request submitted successfully. Waiting for Superuser approval.");
      } catch (err) {
          alert("Failed to submit withdrawal request.");
      } finally {
          setIsRequestingWithdrawal(false);
      }
  };

  const renderWalletModal = () => {
    if (!walletModalOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Load Leader Wallet</h3>
                    <button onClick={() => setWalletModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
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

                    <div>
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (GHS)</label>
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

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
                        You will receive a USSD prompt on your phone to complete the payment.
                    </div>

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
                            {isProcessingWallet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                            Load Wallet
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderWithdrawModal = () => {
    if (!withdrawModalOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Request Withdrawal</h3>
                    <button onClick={() => setWithdrawModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Registered MoMo Number</label>
                        <div className="relative">
                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                value={currentUser.phoneNumber || 'No number set'} 
                                disabled 
                                readOnly 
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono cursor-not-allowed"
                            />
                            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Withdrawals are restricted to your registered profile number for security.
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount ({group.currency})</label>
                            <span className="text-xs text-gray-500">Max: {moneyFormatter(walletBalance, group.currency)}</span>
                        </div>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="number"
                                placeholder="0.00"
                                value={withdrawRequestAmount}
                                onChange={(e) => setWithdrawRequestAmount(e.target.value)}
                                min="1"
                                max={walletBalance}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => setWithdrawModalOpen(false)}
                            className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-bold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRequestWithdrawal}
                            disabled={isRequestingWithdrawal || !withdrawRequestAmount || Number(withdrawRequestAmount) > walletBalance}
                            className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            {isRequestingWithdrawal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                            Request
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderConfirmDialog = () => {
    if (!confirmDialog.isOpen) return null;
    return (
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
    );
  };

  if (group.status === 'SUSPENDED' || group.status === 'DELETED') {
    const adminPersonalTransactions = transactions.filter(tx =>
     tx.userId === currentUser.id &&
     tx.type !== 'CONTRIBUTION'
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
       <div className="space-y-6 animate-fade-in p-6">
           <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
               <ShieldAlert className="w-12 h-12 text-red-600 mx-auto mb-4" />
               <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-2">{group.status === 'DELETED' ? 'Group Deleted' : 'Group Suspended'}</h2>
               <p className="text-red-600 dark:text-red-300 max-w-md mx-auto">
                   {group.status === 'DELETED' 
                    ? 'This group has been deleted by the Superuser. You can still access your personal wallet to withdraw remaining funds.' 
                    : 'This group has been suspended. Access is restricted to wallet functions only.'}
               </p>
           </div>
           
           <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
             <div className="flex items-center gap-3 mb-2">
                 <Wallet className="w-6 h-6 text-green-500" />
                 <h4 className="text-lg font-bold text-gray-800 dark:text-white">Group Leader Wallet</h4>
             </div>
             <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{moneyFormatter(walletBalance, group.currency)}</p>
             <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button onClick={() => setWalletModalOpen(true)} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-bold flex items-center justify-center gap-2"><Smartphone className="w-4 h-4" /> Load Wallet</button>
                  <button onClick={() => setWithdrawModalOpen(true)} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-bold flex items-center justify-center gap-2"><ArrowUpRight className="w-4 h-4" /> Withdraw</button>
             </div>
         </div>

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
                           <td className="px-6 py-4">{new Date(tx.date).toLocaleDateString()}</td>
                           <td className="px-6 py-4"><span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700">{tx.type}</span></td>
                           <td className="px-6 py-4 font-bold">{moneyFormatter(tx.amount, group.currency)}</td>
                           <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{tx.status}</span></td>
                       </tr>
                   )) : (
                     <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No personal transactions found.</td></tr>
                   )}
               </tbody>
           </table>
         </div>

         {renderWalletModal()}
         {renderWithdrawModal()}
         {renderConfirmDialog()}
       </div>
    );
  }

  if (group.status === 'PENDING_VERIFICATION') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-fade-in">
            <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-6">
                <Clock className="w-12 h-12 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Group Verification Pending</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-md mb-8">
                Your group <span className="font-bold text-gray-900 dark:text-white">{group.name}</span> has been created and is currently under review by the Superuser. 
                You will be notified once it is approved and active.
            </p>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 max-w-md">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> While pending, you cannot invite members or process transactions.
                </p>
            </div>

            <div className="mt-8 w-full max-w-md animate-fade-in-up">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400 animate-pulse">
                            <Video className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Verification Call</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Join call with Superuser</p>
                        </div>
                    </div>
                    <button onClick={() => setIsVideoCallOpen(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors shadow-md">Join Now</button>
                </div>
            </div>
            {renderVideoCallModal()}
        </div>
      );
  }

  if (group.status === 'REJECTED') {
       return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-fade-in">
              <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                  <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Group Rejected</h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-md mb-8">
                  Your group <span className="font-bold text-gray-900 dark:text-white">{group.name}</span> was rejected by the Superuser.
              </p>
          </div>
      );
  }

  const activeMembers = members.filter(m => groupMemberships[m.id] === 'ACTIVE' && m.status !== 'SUSPENDED' && m.role !== UserRole.SUPERUSER);
  const pendingMembers = members.filter(m => groupMemberships[m.id] === 'PENDING' && m.role !== UserRole.SUPERUSER);
  const pendingTransactions = transactions.filter(t => t.status === 'PENDING' && t.type === 'CONTRIBUTION');
  
  const cycleTarget = activeMembers.length * group.contributionAmount;
  const collectionProgress = Math.min((totalPoolNumber / (cycleTarget || 1)) * 100, 100);

  // --- ASYNC HANDLERS FOR MYSQL ---

  const handleApproveMember = async (id: string) => {
    try {
        const success = await db.updateGroupMembershipStatus(group.id, id, 'ACTIVE');
        if (!success) throw new Error("Failed to approve member.");

        const member = members.find(m => m.id === id);
        if (member) {
            await db.sendGroupMessage(currentUser, `👋 Welcome ${member.name} to the group!`, group.id);
            await db.createNotification({
                id: `notif-${Date.now()}`,
                recipientId: id,
                title: 'Membership Approved',
                message: `You have been approved to join ${group.name}.`,
                type: 'success',
                timestamp: Date.now(),
                read: false
            });
        }

        if (onRefresh) onRefresh();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
        alert(`Action failed: ${err instanceof Error ? err.message : "Server error."}`);
    }
  };

  const handleRejectMember = async (id: string) => {
    try {
        const member = members.find(m => m.id === id);
        const success = await db.removeMemberFromGroup(group.id, id);
        if (!success) throw new Error("Failed to reject member.");

        if (member) {
             await db.sendGroupMessage(currentUser, `🚫 Membership request for ${member.name} was rejected.`, group.id);
             await db.createNotification({
                id: `notif-${Date.now()}`,
                recipientId: id,
                title: 'Membership Rejected',
                message: `Your request to join ${group.name} was rejected.`,
                type: 'error',
                timestamp: Date.now(),
                read: false
            });
        }

        if (onRefresh) onRefresh();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
        alert(`Action failed: ${err instanceof Error ? err.message : "Server error."}`);
    }
  };

  const handleApproveTransaction = async (txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    
    try {
        await db.verifyTransaction(txId);
        await db.sendGroupMessage(currentUser, `✅ Contribution of ${moneyFormatter(tx.amount, group.currency)} from ${tx.userName} confirmed.`, group.id);
        await db.createNotification({
            id: `notif-${Date.now()}`,
            recipientId: tx.userId,
            title: 'Contribution Approved',
            message: `Your contribution of ${moneyFormatter(tx.amount, group.currency)} has been confirmed.`,
            type: 'success',
            timestamp: Date.now(),
            read: false
        });
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
        await fetch(`http://localhost:3001/api/transactions/${txId}`, { method: 'DELETE' });
        await db.sendGroupMessage(currentUser, `❌ Contribution from ${tx.userName} was rejected.`, group.id);
        await db.createNotification({
            id: `notif-${Date.now()}`,
            recipientId: tx.userId,
            title: 'Contribution Rejected',
            message: `Your contribution of ${moneyFormatter(tx.amount, group.currency)} was rejected. Please contact admin.`,
            type: 'error',
            timestamp: Date.now(),
            read: false
        });
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

  const handleRemoveMemberFromGroup = async (userId: string) => {
    try {
        const member = members.find(m => m.id === userId);
        await db.removeMemberFromGroup(group.id, userId);
        
        // Update local state immediately
        setGroupMemberships(prev => {
            const next = { ...prev };
            delete next[userId];
            return next;
        });

        if (member) {
            await db.sendGroupMessage(currentUser, `🚫 ${member.name} has been removed from the group.`, group.id);
            await db.createNotification({
                id: `notif-${Date.now()}`,
                recipientId: userId,
                title: 'Removed from Group',
                message: `You have been removed from ${group.name}.`,
                type: 'error',
                timestamp: Date.now(),
                read: false
            });
        }
        
        if (onRefresh) onRefresh();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        alert("Member removed from group.");
    } catch (err) {
        alert("Failed to remove member.");
    }
  };

  const handleUpdateGroup = async () => {
    try {
        await db.updateGroup(group.id, group);

        // Notify all members of the group about the update
        for (const member of activeMembersInCycle) {
            if (member.id !== currentUser.id) {
                await db.createNotification({
                    id: `notif-g-update-${Date.now()}-${member.id}`,
                    recipientId: member.id,
                    title: 'Group Settings Updated',
                    message: `The settings for group '${group.name}' have been updated by the admin.`,
                    type: 'info', timestamp: Date.now(), read: false
                });
            }
        }
        alert("Group settings saved permanently to MySQL.");
        if (onRefresh) onRefresh();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        alert(`Failed to save settings: ${message}`);
    }
  };

  const handleStartNewCycle = async (randomize = false) => {
    setIsStartingNewCycle(true);
    try {
      const { newSchedule, cycleStartDate, cycleEndDate } = await db.startNewPayoutCycle(group.id, randomize);
      setPayoutOrder(newSchedule);
      
      // Update local group state immediately to reflect new cycle
      setGroup(prev => ({
          ...prev,
          payoutSchedule: newSchedule,
          cycleStartDate: cycleStartDate,
          cycleEndDate: cycleEndDate
      }));

      await db.sendGroupMessage(currentUser, `🔄 A new payout cycle has started!`, group.id);
      await db.createNotification({
          id: `notif-${Date.now()}`,
          recipientId: 'ALL',
          title: 'New Cycle Started',
          message: `A new payout cycle has started for ${group.name}. Check your schedule!`,
          type: 'info',
          timestamp: Date.now(),
          read: false
      });
      if (onRefresh) onRefresh();
      alert("New payout cycle started successfully");
    } catch (error) {
      console.error("Failed to start new cycle:", error);
      alert("Failed to start new payout cycle. Please try again.");
    } finally {
      setIsStartingNewCycle(false);
    }
  };

  const handleAdminContribution = async () => {
      if (walletBalance < group.contributionAmount) {
          alert(`Insufficient wallet balance. Please load funds first.`);
          setWalletModalOpen(true);
          return;
      }
      setConfirmDialog({
          isOpen: true,
          title: 'Confirm Contribution',
          message: `Are you sure you want to pay your share of ${moneyFormatter(group.contributionAmount, group.currency)}?`,
          type: 'primary',
          onConfirm: async () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
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
                  await db.addTransaction(newTx, group.id);
                  await db.sendGroupMessage(currentUser, `💰 I just contributed ${moneyFormatter(group.contributionAmount, group.currency)}!`, group.id);
                  
                  // Notify all other members in the group
                  for (const member of activeMembersInCycle) {
                      if (member.id !== currentUser.id) {
                          await db.createNotification({
                              id: `notif-admin-contrib-${Date.now()}-${member.id}`, recipientId: member.id,
                              title: 'Leader Contribution', message: `Your group leader, ${currentUser.name}, has paid their share for group '${group.name}'.`,
                              type: 'info', timestamp: Date.now(), read: false
                          });
                      }
                  }

                  if (onRefresh) onRefresh();
                  alert("Admin contribution recorded successfully.");
              } catch (err) {
                  alert("Action failed.");
              }
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const handleToggleMemberForPayout = (memberId: string) => {
    const newSelected = selectedMembersForPayout.includes(memberId)
        ? selectedMembersForPayout.filter(id => id !== memberId)
        : [...selectedMembersForPayout, memberId];
    
    setSelectedMembersForPayout(newSelected);

    if (newSelected.length > 0) {
        const amountPerMember = (totalPoolNumber / newSelected.length).toFixed(2);
        const newAmounts: { [key: string]: string } = {};
        newSelected.forEach(id => {
            newAmounts[id] = amountPerMember;
        });
        setPayoutAmounts(newAmounts);
    } else {
        setPayoutAmounts({});
    }
  };

  const handlePayoutAmountChange = (memberId: string, amount: string) => {
      setPayoutAmounts(prev => ({
          ...prev,
          [memberId]: amount
      }));
  };

  const handleSplitPayout = async () => {
      if (selectedMembersForPayout.length === 0) {
          alert("Please select at least one member to distribute the payout to.");
          return;
      }

      const totalPayoutAmount = Object.values(payoutAmounts).map(v => parseFloat(v) || 0).reduce((sum, v) => sum + v, 0);
      
      if (totalPayoutAmount > totalPoolNumber) {
          alert("The total allocated amount cannot exceed the group pool.");
          return;
      }

      if (totalPayoutAmount <= 0) {
          alert("Please allocate a payout amount greater than zero.");
          return;
      }

      setConfirmDialog({
          isOpen: true,
          title: 'Confirm Split Payout',
          message: `Are you sure you want to distribute ${moneyFormatter(Number(totalPayoutAmount), group.currency)} between ${selectedMembersForPayout.length} members?`,
          type: 'warning',
          onConfirm: async () => {
              setIsProcessingSplitPayout(true);
              try {
                  // Select a random verifier from active members (excluding superusers and admin)
                  const potentialVerifiers = members.filter(m => 
                      m.role !== UserRole.SUPERUSER && 
                      m.id !== currentUser.id && // Exclude Admin/Current User
                      groupMemberships[m.id] === 'ACTIVE' && 
                      m.status !== 'SUSPENDED'
                  );

                  // Filter out recipients to ensure independent verification
                  const independentVerifiers = potentialVerifiers.filter(m => !selectedMembersForPayout.includes(m.id));
                  
                  const verifier = independentVerifiers.length > 0 ? independentVerifiers[Math.floor(Math.random() * independentVerifiers.length)] : null;
                  const txStatus = verifier ? 'PENDING' : 'COMPLETED';

                  const payoutTransactions = selectedMembersForPayout.map(memberId => {
                      const member = members.find(m => m.id === memberId);
                      const amount = parseFloat(payoutAmounts[memberId]) || 0;
                      
                      if (!member || amount <= 0) return null;

                      return {
                          id: `tx-p-split-${Date.now()}-${memberId}`,
                          userId: member.id,
                          userName: member.name,
                          type: 'PAYOUT',
                          amount: amount,
                          date: new Date().toISOString().split('T')[0],
                          status: txStatus,
                          verifierId: verifier?.id
                      };
                  }).filter((tx): tx is Transaction => tx !== null) as Transaction[];
                  
                  if (payoutTransactions.length === 0) {
                      throw new Error("No valid payouts to process.");
                  }

                  for (const tx of payoutTransactions) {
                      await db.addTransaction(tx, group.id);
                  }

                  // Note: Pool is NOT updated here. It updates when status becomes COMPLETED via verification.
                  // Note: Pool is updated by backend if status is COMPLETED. If PENDING, it updates upon verification.

                  let successMessage = `Payouts initiated! ${moneyFormatter(Number(totalPayoutAmount), group.currency)} allocated to ${payoutTransactions.length} members.`;

                  if (verifier) {
                      await db.sendGroupMessage(
                          currentUser, 
                          `🔍 VERIFICATION REQUIRED: ${verifier.name} has been selected to verify the pending payouts. Please check your dashboard to approve.`,
                          group.id
                      );
                      successMessage += `\n\nVerification Required: ${verifier.name} must verify these transactions before funds are released.`;
                      await db.createNotification({
                          id: `notif-${Date.now()}`,
                          recipientId: verifier.id,
                          title: 'Payout Verification Needed',
                          message: `You have been selected to verify a split payout distribution.`,
                          type: 'warning',
                          timestamp: Date.now(),
                          read: false
                      });
                  } else {
                      successMessage += `\n\nPayout completed immediately (No independent verifier available).`;
                  }

                  alert(successMessage);
                  if (onRefresh) onRefresh();
                  
                  setIsSplitPayoutModalOpen(false);
                  setSelectedMembersForPayout([]);

              } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  alert(`Payout failed: ${errorMessage}`);
              } finally {
                  setIsProcessingSplitPayout(false);
                  setConfirmDialog(prev => ({...prev, isOpen: false}));
              }
          }
      });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://digitalsusu.app/join/${group.inviteCode}`);
    alert("Group invite link copied to clipboard!");
  };

  // --- RENDERERS ---

  const renderOverview = () => {
    // --- Time-Based Cycle Progress ---
    const now = new Date().getTime();
    const start = group.cycleStartDate ? new Date(group.cycleStartDate).getTime() : now;
    const end = group.cycleEndDate ? new Date(group.cycleEndDate).getTime() : now + 1000 * 60 * 60 * 24 * 30; // Default 30 days if null
    const totalDuration = end - start;
    const elapsed = now - start;
    // Calculate percentage, clamped between 0 and 100
    const timeProgress = totalDuration > 0 ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100) : 0;
    const daysRemaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

    // --- Payment Progress (Reset on new cycle) ---
    // Filter transactions to only include those in the current cycle (after start date)
    const currentCycleContributions = groupContributionTransactions.filter(t => 
        new Date(t.date).getTime() >= start && t.status === 'COMPLETED'
    );
    
    // Count unique members who have contributed in this cycle
    const paidMemberIds = new Set(currentCycleContributions.map(t => t.userId));
    const paidCount = paidMemberIds.size;
    const pendingCount = Math.max(0, activeMembers.length - paidCount);

    const pieData = [{ name: 'Paid', value: paidCount }, { name: 'Pending', value: pendingCount }];
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
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Active Cycle Progress ({group.frequency})</h3>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Time Remaining</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{daysRemaining} Days</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">Elapsed Time vs Duration</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={[
                      { name: 'Time', elapsed: timeProgress, total: 100 }
                    ]}>
                      <defs>
                        <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" unit="%" />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                      <Area type="monotone" dataKey="elapsed" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTime)" name="Elapsed %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">START DATE</p>
                  <p className="text-sm font-bold text-green-700 dark:text-green-300">{new Date(start).toLocaleDateString()}</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">END DATE</p>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{new Date(end).toLocaleDateString()}</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">ELAPSED</p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{Math.round(timeProgress)}%</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Payment Progress (Current Cycle)</h3>
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
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{Math.round((paidCount / (activeMembers.length || 1)) * 100)}%</p>
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
          (groupMemberships[member.id] === 'ACTIVE' || groupMemberships[member.id] === 'SUSPENDED') &&
          (member.name.toLowerCase().includes(searchTerm.toLowerCase()) || member.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      const pendingMembersForCurrentGroup = members.filter(member =>
          member.role !== UserRole.SUPERUSER &&
          groupMemberships[member.id] === 'PENDING' &&
          (member.name.toLowerCase().includes(searchTerm.toLowerCase()) || member.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      return (
      <div className="space-y-6 animate-fade-in">
        {/* <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6 flex items-center gap-2"><History className="w-5 h-5 text-gray-400"/> Payout History</h3>
            <div className="space-y-4">
              {allTimePayoutHistory.length > 0 ? allTimePayoutHistory.map(tx => (
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
                  No payout history found.
                </div>
              )}
            </div>
        </div> */}

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
              {filteredMembers.map(member => {
                  const groupStatus = groupMemberships[member.id];
                  // A global suspension by a superuser should override the group-specific status.
                  const effectiveStatus = member.status === 'SUSPENDED' ? 'SUSPENDED' : groupStatus;
                  return (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4"><div className="flex items-center gap-3"><img src={member.avatar} alt="" className="w-8 h-8 rounded-full" /><div><p className="font-medium text-gray-900 dark:text-white">{member.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p></div></div></td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${effectiveStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : effectiveStatus === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{effectiveStatus}</span></td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{member.joinDate}</td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${member.reliabilityScore || 0}%` }}></div></div>
                                <span className="text-xs text-gray-600">{member.reliabilityScore}%</span>
                            </div>
                    </td>
                    <td className="px-6 py-4 text-right"><button onClick={() => setViewMember(member)} className="p-2 text-gray-400 hover:text-primary-600"><Eye className="w-5 h-5" /></button></td>
                  </tr>
                  )})}
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
    const filteredContributionTransactions = groupContributionTransactions.filter(tx => {
        const matchesSearch = tx.userName.toLowerCase().includes(searchTerm.toLowerCase());
        let matchesDate = true;
        if (txDateFrom && tx.date < txDateFrom) matchesDate = false;
        if (txDateTo && tx.date > txDateTo) matchesDate = false;
        return matchesSearch && matchesDate;
    }).sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return txSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // Filter transactions for the current administrator, excluding contributions which are now in the main table
    const adminPersonalTransactions = transactions.filter(tx =>
        tx.userId === currentUser.id &&
        tx.type !== 'CONTRIBUTION' &&
        (tx.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
         tx.type.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending

    return (
      <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Member Contributions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <Users className="w-6 h-6 text-blue-500" />
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white">Member Contributions</h4>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{moneyFormatter(group.totalPool, group.currency)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total funds collected from members for the current cycle.</p>
                <div className="mt-4">
                     <button 
                         onClick={() => setIsSplitPayoutModalOpen(true)}
                         disabled={group.totalPool <= 0 || isPayoutCycleComplete}
                         className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        <Shuffle className="w-4 h-4" /> Distribute Payout
                    </button>
                </div>
            </div>

            {/* Card 2: Group Leader Wallet */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <Wallet className="w-6 h-6 text-green-500" />
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white">Group Leader Wallet</h4>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{moneyFormatter(walletBalance, group.currency)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Your personal funds to manage group payments.</p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                     <button onClick={() => setWalletModalOpen(true)} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-bold flex items-center justify-center gap-2"><Smartphone className="w-4 h-4" /> Load Wallet</button>
                     <button onClick={() => setWithdrawModalOpen(true)} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-bold flex items-center justify-center gap-2"><ArrowUpRight className="w-4 h-4" /> Withdraw</button>
                     <button onClick={handleAdminContribution} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center justify-center gap-2"><DollarSign className="w-4 h-4" /> Pay My Share</button>
                </div>
            </div>
        </div>
          {/* Member Contribution Transactions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Member Contribution Transactions</h3>
                  <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-1 rounded-lg border border-gray-200 dark:border-gray-600">
                          <span className="text-xs text-gray-500 dark:text-gray-400 pl-2">Date:</span>
                          <input 
                              type="date" 
                              value={txDateFrom} 
                              onChange={(e) => setTxDateFrom(e.target.value)} 
                              className="bg-transparent border-none text-xs text-gray-900 dark:text-white focus:ring-0 p-1"
                              placeholder="From"
                          />
                          <span className="text-gray-400">-</span>
                          <input 
                              type="date" 
                              value={txDateTo} 
                              onChange={(e) => setTxDateTo(e.target.value)} 
                              className="bg-transparent border-none text-xs text-gray-900 dark:text-white focus:ring-0 p-1"
                              placeholder="To"
                          />
                          {(txDateFrom || txDateTo) && (
                              <button onClick={() => { setTxDateFrom(''); setTxDateTo(''); }} className="p-1 hover:text-red-500 text-gray-400">
                                  <X className="w-3 h-3" />
                              </button>
                          )}
                      </div>
                  </div>
              </div>
              <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      <tr>
                          <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group" onClick={() => setTxSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                              <div className="flex items-center gap-1">
                                  Date
                                  {txSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary-600" /> : <ArrowDown className="w-3 h-3 text-primary-600" />}
                              </div>
                          </th>
                          <th className="px-6 py-4">Member Name</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredContributionTransactions.length > 0 ? filteredContributionTransactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-6 py-4">{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                              <td className="px-6 py-4 font-medium">{tx.userName}</td>
                              <td className="px-6 py-4 font-bold">{moneyFormatter(tx.amount, group.currency)}</td>
                              <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{tx.status}</span></td>
                              <td className="px-6 py-4 text-right">
                                {tx.status === 'PENDING' ? (
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setConfirmDialog({ isOpen: true, title: 'Approve Transaction', message: `Approve this ${moneyFormatter(tx.amount, group.currency)} contribution from ${tx.userName}?`, type: 'primary', onConfirm: () => handleApproveTransaction(tx.id) }); }} className="p-1 bg-green-100 text-green-700 rounded" title="Approve"><Check className="w-4 h-4" /></button>
                                        <button onClick={() => { setConfirmDialog({ isOpen: true, title: 'Reject Transaction', message: `Reject this contribution from ${tx.userName}?`, type: 'danger', onConfirm: () => handleRejectTransaction(tx.id) }); }} className="p-1 bg-red-100 text-red-700 rounded" title="Reject"><X className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    tx.is_rolled_back ? 
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Rolled Back</span> :
                                    <span className="text-xs text-gray-400 italic">Completed</span>
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
                              <td className="px-6 py-4">{new Date(tx.date).toLocaleDateString()}</td>
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
                  
                  <div>
                      <label className="block text-sm font-medium mb-2">Scheduled Payout Amount</label>
                      <input 
                        type="number" 
                        value={group.scheduledPayoutAmount || ''} 
                        onChange={(e) => setGroup({...group, scheduledPayoutAmount: Number(e.target.value)})} 
                        className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700" 
                        placeholder="0.00"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Estimated based on contributions: {moneyFormatter(group.contributionAmount * activeMembers.length, group.currency)}
                      </p>
                  </div>

                  {/* Frequency Setting */}
                  <div>
                      <label className="block text-sm font-medium mb-2">Frequency</label>
                      <select value={group.frequency} onChange={(e) => setGroup({...group, frequency: e.target.value as any})} className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700">
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Bi-Weekly">Bi-Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Yearly">Yearly</option>
                      </select>
                  </div>

                  <div><button type="submit" className="px-6 py-3 bg-primary-600 text-white rounded-lg font-bold shadow-md"><Save className="w-4 h-4 mr-2 inline" /> Save Changes</button></div>
              </form>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Manage Group Members</h3>
              <div className="space-y-3">
                  {members.filter(m => groupMemberships[m.id] && m.role !== UserRole.SUPERUSER).map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div className="flex items-center gap-3">
                              <img src={member.avatar} alt="" className="w-10 h-10 rounded-full" />
                              <div>
                                  <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{member.role}</p>
                                    {member.status === 'SUSPENDED' && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 rounded">System Suspended</span>}
                                  </div>
                              </div>
                          </div>
                          {member.role !== UserRole.ADMIN && (
                              <button 
                                  onClick={() => setConfirmDialog({
                                      isOpen: true,
                                      title: 'Remove Member',
                                      message: `Are you sure you want to remove ${member.name} from the group?`,
                                      type: 'danger',
                                      onConfirm: () => handleRemoveMemberFromGroup(member.id)
                                  })}
                                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Remove from Group"
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          )}
                      </div>
                  ))}
                  {activeMembers.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No active members found.</p>
                  )}
              </div>
          </div>
      </div>
  );

  const renderPayouts = () => {
    // --- Payout Cycle Logic ---

    // Use derived state from top level
    const membersWhoHaveReceived = activeMembersInCycle.filter(m => paidUserIds.has(m.id));
    const membersYetToReceive = activeMembersInCycle.filter(m => !paidUserIds.has(m.id));

    // Find the next member in the payout order who hasn't been paid.
    const validPayoutOrder = payoutOrder.filter(userId => activeMembersInCycle.some(m => m.id === userId));
    const nextRecipientId = validPayoutOrder.find(userId => !paidUserIds.has(userId));
    const nextRecipient = nextRecipientId ? members.find(m => m.id === nextRecipientId) : undefined;
    
    // Find the index of the next recipient for highlighting in the UI.
    const nextUserIndex = validPayoutOrder.findIndex(userId => !paidUserIds.has(userId));

    const handleRejectPayout = async () => {
        if (!nextRecipient) return;
        
        if (confirm(`Are you sure you want to skip ${nextRecipient.name} for this payout? They will be moved to the end of the schedule.`)) {
            const newOrder = payoutOrder.filter(id => id !== nextRecipient.id);
            newOrder.push(nextRecipient.id);
            
            setPayoutOrder(newOrder);
            try {
                await db.updateGroup(group.id, { ...group, payoutSchedule: newOrder });
                if (onRefresh) onRefresh();
            } catch (e) {
                console.error("Failed to skip member:", e);
                alert("Failed to update payout order.");
            }
        }
    };

    const handleManualPayout = async () => {
        if (!nextRecipient) {
            alert("No one is scheduled for the next payout.");
            return;
        }

        const payoutAmount = (group.scheduledPayoutAmount && group.scheduledPayoutAmount > 0)
            ? group.scheduledPayoutAmount
            : group.totalPool;

        if (group.totalPool < payoutAmount) {
            alert(`Insufficient funds in the group pool for this payout. Required: ${moneyFormatter(payoutAmount, group.currency)}, Available: ${moneyFormatter(group.totalPool, group.currency)}`);
            return;
        }

        setConfirmDialog({
            isOpen: true,
            title: 'Confirm Manual Payout',
            message: `Are you sure you want to send ${moneyFormatter(payoutAmount, group.currency)} to ${
                nextRecipient.name
            }?`,
            type: 'warning',
            onConfirm: async () => {
                setIsProcessingPayout(true);
                try {
                    // Select a random verifier from active members (excluding superusers, admin, and recipient)
                    const potentialVerifiers = members.filter(m => 
                        m.role !== UserRole.SUPERUSER && 
                        m.id !== currentUser.id && // Exclude Admin/Current User
                        groupMemberships[m.id] === 'ACTIVE' && 
                        m.status !== 'SUSPENDED' &&
                        m.id !== nextRecipient.id // Exclude recipient
                    );

                    const verifier = potentialVerifiers.length > 0 ? potentialVerifiers[Math.floor(Math.random() * potentialVerifiers.length)] : null;
                    const txStatus = verifier ? 'PENDING' : 'COMPLETED';

                    await new Promise(res => setTimeout(res, 1500)); 

                    const newTx: Transaction = {
                        id: `tx-p-${Date.now()}`,
                        userId: nextRecipient.id,
                        userName: nextRecipient.name,
                        type: 'PAYOUT',
                        amount: payoutAmount,
                        date: new Date().toISOString().split('T')[0],
                        status: txStatus,
                        verifierId: verifier?.id
                    };

                    await db.addTransaction(newTx, group.id);
                    
                    await db.updateGroup(group.id, { ...group, totalPool: group.totalPool - payoutAmount });
                    let successMessage = `Payout initiated! ${moneyFormatter(payoutAmount, group.currency)} sent to ${nextRecipient.name}.`;

                    alert(`Payout successful! ${nextRecipient.name} has been paid.`);
                    if (verifier) {
                        await db.sendGroupMessage(
                            currentUser, 
                            `🔍 VERIFICATION REQUIRED: ${verifier.name} has been selected to verify the pending payout to ${nextRecipient.name}. Please check your dashboard to approve.`,
                            group.id
                        );
                        await db.createNotification({
                            id: `notif-${Date.now()}`,
                            recipientId: verifier.id,
                            title: 'Payout Verification Needed',
                            message: `Please verify the payout of ${moneyFormatter(payoutAmount, group.currency)} to ${nextRecipient.name}.`,
                            type: 'warning',
                            timestamp: Date.now(),
                            read: false
                        });
                        successMessage += `\n\nVerification Required: ${verifier.name} must verify this transaction before funds are released.`;
                    } else {
                        successMessage += `\n\nPayout completed immediately (No independent verifier available).`;
                    }

                    alert(successMessage);
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

    const handleReorder = async (newOrder: string[]) => {
      setPayoutOrder(newOrder);
      try {
          await db.updateGroup(group.id, { ...group, payoutSchedule: newOrder });
          if (onRefresh) onRefresh();
          alert("Payout order updated.");
      } catch (e) {
          console.error("Failed to reorder:", e);
          alert("Failed to update payout order.");
      }
    };

    const handleRollbackContribution = async (memberId: string) => {
        const currentCycleStart = group.cycleStartDate ? new Date(group.cycleStartDate).getTime() : 0;
        // Find the latest completed contribution for this member in this cycle
        const memberContribs = groupContributionTransactions
            .filter(t => t.userId === memberId && new Date(t.date).getTime() >= currentCycleStart && t.status === 'COMPLETED')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (memberContribs.length === 0) return;
        const tx = memberContribs[0];

        setConfirmDialog({
            isOpen: true,
            title: 'Rollback Contribution',
            message: `Are you sure you want to rollback the Member,${tx.userName}?.`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/transactions/${tx.id}/rollback`, { 
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        await db.sendGroupMessage(currentUser, `⚠️ Contribution for ${tx.userName} has been rolled back.`, group.id);
                        alert("Member contribution has been rolled back.");
                        if (onRefresh) onRefresh();
                    } else {
                        alert("Failed to rollback contribution.");
                    }
                } catch (err: unknown) {
                    console.error(err);
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    alert(`Error connecting to server: ${errorMessage}`);
                }
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleRollbackAllContributions = async () => {
        const currentCycleStart = group.cycleStartDate ? new Date(group.cycleStartDate).getTime() : 0;
        
        // Find all completed contributions for the current cycle
        const txsToRollback = groupContributionTransactions
            .filter(t => new Date(t.date).getTime() >= currentCycleStart && t.status === 'COMPLETED')
            .map(t => t.id);

        if (txsToRollback.length === 0) return;

        setConfirmDialog({
            isOpen: true,
            title: 'Rollback All Contributions',
            message: `Are you sure you want to reset the status for ALL ${txsToRollback.length} paid members in this cycle? This will mark them as Pending but NOT refund the pool.`,
            type: 'danger',
            onConfirm: async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/transactions/bulk-rollback`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ transactionIds: txsToRollback })
                    });
                    
                    if (res.ok) {
                        await db.sendGroupMessage(currentUser, `⚠️ All contributions for this cycle have been rolled back.`, group.id);
                        alert("All paid member contributions have been rolled back for this cycle.");
                        if (onRefresh) onRefresh();
                    } else {
                        alert("Failed to rollback transactions.");
                    }
                } catch (err: unknown) {
                    console.error(err);
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    alert(`Error connecting to server: ${errorMessage}`);
                }
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // Contribution Logic for Current Cycle
    const currentCycleStart = group.cycleStartDate ? new Date(group.cycleStartDate).getTime() : 0;
    const paidContribUserIds = new Set(
        groupContributionTransactions
            .filter(t => new Date(t.date).getTime() >= currentCycleStart && t.status === 'COMPLETED' && !t.is_rolled_back)
            .map(t => t.userId)
    );
    const membersWhoPaidContrib = activeMembersInCycle.filter(m => paidContribUserIds.has(m.id));
    const membersWhoNotPaidContrib = activeMembersInCycle.filter(m => !paidContribUserIds.has(m.id));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Next Payout Recipient</h3>
                    {isPayoutCycleComplete ? (
                        // This view shows when the payout cycle is complete.
                        <div className="text-center p-8 bg-green-50 dark:bg-green-700/50 rounded-lg">
                            <p className="font-medium text-gray-700 dark:text-gray-300">All members have been paid for this cycle!</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">You can now start a new payout cycle.</p>
                             <button 
                                onClick={() => handleStartNewCycle()} 
                                disabled={isStartingNewCycle}
                                className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isStartingNewCycle ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                {isStartingNewCycle ? 'Starting...' : 'Start New Payout Cycle'}
                            </button>
                        </div>
                    ) : nextRecipient ? (
                        // This view shows the next person to be paid.
                        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-lg">
                           <div className="flex items-center gap-4">
                               <img src={nextRecipient.avatar} alt={nextRecipient.name} className="w-12 h-12 rounded-full border-2 border-white"/>
                               <div>
                                   <p className="font-bold text-lg text-primary-800 dark:text-primary-300">{nextRecipient.name}</p>
                                   <p className="text-sm text-primary-600 dark:text-primary-400">Scheduled for <span className="font-bold">{moneyFormatter(group.scheduledPayoutAmount || 0, group.currency)}</span></p>
                               </div>
                           </div>
                           <div className="flex gap-3 mt-4 sm:mt-0 w-full sm:w-auto">
                                <button 
                                    onClick={handleRejectPayout}
                                    disabled={isProcessingPayout}
                                    className="flex-1 sm:flex-none px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 rounded-lg font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <XCircle className="w-5 h-5" />
                                    Reject
                                </button>
                                <button 
                                    onClick={handleManualPayout} 
                                    disabled={isProcessingPayout || group.totalPool <= 0}
                                    className="flex-1 sm:flex-none px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isProcessingPayout ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    {isProcessingPayout ? 'Processing...' : 'Pay Now'}
                                </button>
                           </div>
                        </div>
                    ) : (
                        // This view shows while data is loading or if there's no next recipient.
                        <div className="text-center p-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <p className="font-medium text-gray-700 dark:text-gray-300">Loading payout information...</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">If the cycle is complete, the option to start a new one will appear here.</p>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Payout Cycle Status</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleReorder([...payoutOrder].sort(() => Math.random() - 0.5))} className="p-2 text-gray-500 hover:text-primary-600 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm transition-colors" title="Randomize Order">
                                <Shuffle className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Queue</th>
                                    <th className="px-6 py-3 font-medium">Member</th>
                                    <th className="px-6 py-3 font-medium">Status</th>
                                    <th className="px-6 py-3 font-medium text-right">Paid Amount</th>
                                    <th className="px-6 py-3 font-medium text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {validPayoutOrder.map((userId, index) => {
                                    const member = members.find(m => m.id === userId);
                                    if (!member) return null;
                                    const isPaid = paidUserIds.has(userId);
                                    const payoutTx = currentCyclePayoutHistory.find(t => t.userId === userId);
                                    const isNext = index === nextUserIndex;

                                    return (
                                        <tr key={userId} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isNext ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                            <td className="px-6 py-4">
                                                <span className={`font-mono font-bold ${isNext ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    #{index + 1}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <img src={member.avatar} alt="" className="w-8 h-8 rounded-full" />
                                                    <p className={`font-medium ${isNext ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>{member.name}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isPaid ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                                        <CheckCircle className="w-3 h-3" /> Paid
                                                    </span>
                                                ) : isNext ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse">
                                                        <Clock className="w-3 h-3" /> Next Up
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                                                {isPaid && payoutTx 
                                                    ? moneyFormatter(payoutTx.amount, group.currency)
                                                    : <span className="text-gray-400">-</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">
                                                {isPaid && payoutTx 
                                                    ? new Date(payoutTx.date).toLocaleDateString()
                                                    : <span className="text-gray-400">-</span>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                                {validPayoutOrder.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                            No members in payout schedule.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
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

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Cycle Contribution Status</h3>
                        {membersWhoPaidContrib.length > 0 && (
                            <button 
                                onClick={handleRollbackAllContributions}
                                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <RotateCcw className="w-3 h-3" /> Rollback All
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="font-bold text-sm text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" /> Paid ({membersWhoPaidContrib.length})
                            </h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {membersWhoPaidContrib.length > 0 ? membersWhoPaidContrib.map(member => (
                                    <div key={member.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                                        <div className="flex items-center gap-3">
                                            <img src={member.avatar} alt="" className="w-8 h-8 rounded-full" />
                                            <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{member.name}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleRollbackContribution(member.id)}
                                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                            title="Rollback Contribution"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                    </div>
                                )) : <p className="text-sm text-gray-500 italic">No contributions yet for this cycle.</p>}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Pending ({membersWhoNotPaidContrib.length})
                            </h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {membersWhoNotPaidContrib.length > 0 ? membersWhoNotPaidContrib.map(member => (
                                    <div key={member.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                                        <div className="flex items-center gap-3">
                                            <img src={member.avatar} alt="" className="w-8 h-8 rounded-full" />
                                            <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{member.name}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleRollbackContribution(member.id)}
                                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                            title="Rollback Status (Keep Funds)"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                    </div>
                                )) : <p className="text-sm text-gray-500 italic">All members have contributed.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payout History Column payout */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6 flex items-center gap-2"><History className="w-5 h-5 text-gray-400"/> Payout History</h3>
                <div className="space-y-4">
                  {allTimePayoutHistory.length > 0 ? allTimePayoutHistory.map(tx => (
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
                      No payout history found.
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
            const member = members.find(m => m.id === id);
            
            // Select a random verifier from active members (excluding superusers, admin, and target)
            const potentialVerifiers = members.filter(m => 
                m.role !== UserRole.SUPERUSER && 
                m.id !== currentUser.id && 
                m.id !== id && // Not the target
                groupMemberships[m.id] === 'ACTIVE' && 
                m.status !== 'SUSPENDED'
            );
            const verifier = potentialVerifiers.length > 0 ? potentialVerifiers[Math.floor(Math.random() * potentialVerifiers.length)] : null;

            const success = await db.updateGroupMembershipStatus(group.id, id, 'SUSPENDED', verifier?.id);
            if (success) {
                if (verifier && member) {
                    await db.sendGroupMessage(currentUser, `🔍 VERIFICATION REQUIRED: ${verifier.name} has been selected to verify the suspension of ${member.name}.`, group.id);
                    await db.createNotification({
                        id: `notif-${Date.now()}`,
                        recipientId: verifier.id,
                        title: 'Suspension Verification Needed',
                        message: `Please verify the suspension request for ${member.name}.`,
                        type: 'warning',
                        timestamp: Date.now(),
                        read: false
                    });
                    alert(`Suspension request initiated. ${verifier.name} must verify.`);
                } else if (member) {
                    await db.sendGroupMessage(currentUser, `⛔ ${member.name} has been suspended from the group.`, group.id);
                    alert("Member has been suspended from the group.");
                }
                if (onRefresh) onRefresh();
                setViewMember(null);
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            } else {
                throw new Error("Server operation failed.");
            }
        } catch (err) {
            alert("Action failed. Server error.");
        }
      }
    });
  };

  const renderSplitPayoutModal = () => {
    if (!isSplitPayoutModalOpen) return null;

    const activeMembersForPayout = members.filter(member =>
        member.role !== UserRole.SUPERUSER &&
        groupMemberships[member.id] === 'ACTIVE' &&
        member.status !== 'SUSPENDED'
    );
    
    const totalAllocated = Object.values(payoutAmounts).map(v => parseFloat(v) || 0).reduce((sum, v) => sum + v, 0);
    const remainder = totalPoolNumber - totalAllocated;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Shuffle className="w-6 h-6 text-primary-600"/>
                        Distribute Group Payout
                    </h3>
                    <button onClick={() => { setIsSplitPayoutModalOpen(false); setSelectedMembersForPayout([]); }} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <X className="w-5 h-5 text-gray-500"/>
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                         <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                            <p className="text-sm text-blue-600 dark:text-blue-300">Total Pool</p>
                            <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{moneyFormatter(totalPoolNumber, group.currency)}</p>
                        </div>
                        <div className={`p-3 rounded-lg border ${totalAllocated > totalPoolNumber ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'}`}>
                            <p className={`text-sm ${totalAllocated > totalPoolNumber ? 'text-red-600 dark:text-red-300' : 'text-green-600 dark:text-green-300'}`}>Total Allocated</p>
                            <p className={`text-2xl font-bold ${totalAllocated > totalPoolNumber ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200'}`}>{moneyFormatter(totalAllocated, group.currency)}</p>
                        </div>
                         <div className="bg-gray-50 dark:bg-gray-900/20 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                            <p className="text-sm text-gray-600 dark:text-gray-300">Remainder</p>
                            <p className={`text-2xl font-bold ${remainder < 0 ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>{moneyFormatter(totalPoolNumber - totalAllocated, group.currency)}</p>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                             <h4 className="font-bold text-gray-800 dark:text-gray-200">Select Members ({selectedMembersForPayout.length} selected)</h4>
                             <button 
                                onClick={() => setSelectedMembersForPayout(activeMembersForPayout.map(m => m.id))}
                                className="text-sm font-medium text-primary-600 hover:underline"
                            >
                                Select All
                            </button>
                        </div>
                       
                        <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-lg p-2 bg-gray-50 dark:bg-gray-700/50">
                            {activeMembersForPayout.map(member => (
                                <div key={member.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${selectedMembersForPayout.includes(member.id) ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                                    <input 
                                        type="checkbox"
                                        id={`member-payout-${member.id}`}
                                        checked={selectedMembersForPayout.includes(member.id)}
                                        onChange={() => handleToggleMemberForPayout(member.id)}
                                        className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                    />
                                    <label htmlFor={`member-payout-${member.id}`} className="flex-1 flex items-center gap-3 cursor-pointer">
                                        <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
                                        <span className="font-medium text-gray-800 dark:text-gray-200">{member.name}</span>
                                    </label>
                                     {selectedMembersForPayout.includes(member.id) && (
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{group.currency}</span>
                                             <input 
                                                type="number"
                                                value={payoutAmounts[member.id] || ''}
                                                onChange={(e) => handlePayoutAmountChange(member.id, e.target.value)}
                                                className="w-40 pl-10 pr-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-right font-semibold"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                 <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end items-center gap-3">
                    <button onClick={() => { setIsSplitPayoutModalOpen(false); setSelectedMembersForPayout([]); }} className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg">Cancel</button>
                    <button 
                        onClick={handleSplitPayout} 
                        disabled={isProcessingSplitPayout || selectedMembersForPayout.length === 0 || totalAllocated <= 0 || totalAllocated > totalPoolNumber}
                        className="px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                         {isProcessingSplitPayout ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                         {isProcessingSplitPayout ? 'Processing...' : `Distribute to ${selectedMembersForPayout.length} members`}
                    </button>
                </div>
            </div>
        </div>
    );
  };

  const renderMemberDetailsModal = () => {
    if (!viewMember) return null;

    const memberTransactions = [
        ...groupContributionTransactions.filter(t => t.userId === viewMember.id),
        ...allTimePayoutHistory.filter(t => t.userId === viewMember.id)
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const groupStatus = groupMemberships[viewMember.id];
    // A global suspension by a superuser should override the group-specific status.
    const effectiveStatus = viewMember.status === 'SUSPENDED' ? 'SUSPENDED' : groupStatus;

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
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${effectiveStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : effectiveStatus === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{effectiveStatus}</span>
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
                    {effectiveStatus === 'SUSPENDED' ? (
                        viewMember.status === 'SUSPENDED' ? (
                             <button disabled className="px-4 py-2 text-sm font-bold text-white bg-gray-400 dark:bg-gray-600 rounded-lg flex items-center gap-2 cursor-not-allowed opacity-70"><Lock className="w-4 h-4"/> System Suspended</button>
                        ) : (
                             <button onClick={() => setConfirmDialog({ isOpen: true, title: 'Reactivate Member', message: `Restore access for ${viewMember.name}?`, type: 'primary', onConfirm: () => handleApproveMember(viewMember.id) })} className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Reactivate Member</button>
                        )
                    ) : (
                        <button onClick={() => handleSuspendMember(viewMember.id)} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2"><Trash2 className="w-4 h-4"/> Suspend Member</button>
                    )}
                    <button className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"><UserCog className="w-4 h-4"/> Manage Member Roles</button>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6">
        {/* Incoming Call Alert Banner */}
        {group.callActive && !isVideoCallOpen && ( <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between mb-6 animate-fade-in-up sticky top-0 z-40">
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                <div className="p-3 bg-white/20 rounded-full animate-bounce">
                    <PhoneIncoming className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h4 className="font-bold text-lg">Incoming Video Call</h4>
                    <p className="text-indigo-100 text-sm">Superuser is requesting a video verification call.</p>
                </div>
            </div>
            <div className="flex gap-3">
                <button onClick={() => setIsVideoCallOpen(true)} className="px-6 py-2 bg-white text-indigo-600 hover:bg-indigo-50 font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2">
                    <Video className="w-4 h-4" /> Answer Call
                </button>
            </div>
        </div>
        )}

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
        
        {renderSplitPayoutModal()}
        {viewMember && renderMemberDetailsModal()}

        {renderVideoCallModal()}
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

        {renderWalletModal()}
        {renderWithdrawModal()}
        {renderConfirmDialog()}
    </div>
  );
};
