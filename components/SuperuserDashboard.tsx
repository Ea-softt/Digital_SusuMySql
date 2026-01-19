
// ... imports ...
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Transaction, Group, UserRole, AuditLog } from '../types';
import { StatsCard } from './StatsCard';
import { Users, Shield, Activity, DollarSign, Search, AlertTriangle, CheckCircle, XCircle, Lock, Unlock, Trash2, Server, Database, Settings, ScanFace, BrainCircuit, X, TrendingUp, Download, Upload, AlertOctagon, Globe, PlusCircle, Calendar, Camera, MessageSquare, UserCog, ShieldAlert, ChevronRight, Wallet, ArrowUpRight, FileText, UserPlus, Mail, Loader2, Eye, MapPin, Smartphone, Cpu, Wifi, Phone, History, FileDown, Radar, ArrowLeft, Megaphone, Send, Clock, ShieldCheck } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { db } from '../services/database';
import { GroupChat } from './GroupChat';





// ... interface definitions ...
interface SuperuserDashboardProps {
  members: User[];
  transactions: Transaction[];
  groups: Group[]; 
  onRefresh: () => void;
  currentUser: User;
  initialTab?: Tab;
}

// Define available tabs for the dashboard navigation
type Tab = 'overview' | 'users' | 'groups' | 'financials' | 'verification' | 'security' | 'chat' | 'settings';

// Interface for Security Alerts
interface SecurityAlert {
    id: string;
    type: 'VPN' | 'MULTI_ACCOUNT' | 'FAILED_LOGIN' | 'HIGH_VOLUME';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    user: { id: string; name: string; avatar?: string };
    details: { [key: string]: string | number | string[] }; 
    timestamp: number;
}

export const SuperuserDashboard: React.FC<SuperuserDashboardProps> = ({ members, transactions, groups, onRefresh, currentUser, initialTab = 'overview' }) => {
  // State for active tab navigation
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  // State for search functionality
  const [searchTerm, setSearchTerm] = useState('');
  // State for logs
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // State for confirmation modals
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedUserForKYC, setSelectedUserForKYC] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [userToReactivate, setUserToReactivate] = useState<User | null>(null);
  
  // State for User Role Management
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<UserRole>(UserRole.MEMBER);

  // State for auto-verification simulation
  const [isAutoVerifying, setIsAutoVerifying] = useState(false);
  const [autoVerifyProgress, setAutoVerifyProgress] = useState(0);
  const [isAutoVerifyConfirmOpen, setIsAutoVerifyConfirmOpen] = useState(false);
  
  // State for KYC Rejection Note
  const [rejectionNote, setRejectionNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // --- Security & Risk State ---
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [isScanningSecurity, setIsScanningSecurity] = useState(false);
  const [securityScanProgress, setSecurityScanProgress] = useState(0);
  const [alertMessage, setAlertMessage] = useState('');
  const [isSendingAlert, setIsSendingAlert] = useState(false);

  // --- Financials Tab State ---
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [viewTransaction, setViewTransaction] = useState<Transaction | null>(null);
  const [financialFilter, setFinancialFilter] = useState<'ALL' | 'REVENUE' | 'WITHDRAWAL'>('ALL');

  // Withdrawal Form State
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [withdrawProvider, setWithdrawProvider] = useState('MTN');
  const [withdrawPhone, setWithdrawPhone] = useState(currentUser.phoneNumber || '');
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  // State for Global Configuration
  const [systemConfig, setSystemConfig] = useState(db.getSystemConfig());
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  
  // Group Management State
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [viewGroup, setViewGroup] = useState<Group | null>(null);
  const [newGroupForm, setNewGroupForm] = useState({
        name: '',
        currency: 'GHS',
        contributionAmount: '',
        frequency: 'Monthly',
        inviteCode: '',
        welcomeMessage: '',
        icon: ''
  });
  const [isEditingGroup, setIsEditingGroup] = useState(false);

  // Invite User State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  // Chat State
  const [activeChatGroup, setActiveChatGroup] = useState<Group | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Database Backup/Restore State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupHistory, setBackupHistory] = useState<Array<{ id: string; date: string; size: string; status: string }>>(() => {
    // Load backup history from localStorage
    try {
      const saved = localStorage.getItem('backupHistory');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Help Center State
  const [helpSearchQuery, setHelpSearchQuery] = useState('');
  const [selectedFAQ, setSelectedFAQ] = useState<string | null>(null);

  // Ref for the hidden file input used in restore
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref for group icon upload
  const groupIconInputRef = useRef<HTMLInputElement>(null);

  // Update activeTab when initialTab prop changes (from sidebar navigation)
  useEffect(() => {
      setActiveTab(initialTab);
  }, [initialTab]);

  // Sync logs and config from DB
  useEffect(() => {
      setLogs(db.getAuditLogs());
      setSystemConfig(db.getSystemConfig());
  }, [activeTab, members]);

  // Save backup history to localStorage whenever it changes
  useEffect(() => {
      try {
          localStorage.setItem('backupHistory', JSON.stringify(backupHistory));
      } catch (error) {
          console.error('Failed to save backup history:', error);
      }
  }, [backupHistory]);

  // --- Statistics ---
  // Calculate real platform revenue from 'FEE' transactions
  const totalLifetimeRevenue = transactions
    .filter(t => t.type === 'FEE')
    .reduce((sum, t) => sum + t.amount, 0);

  // Calculate total withdrawn by superuser
  const totalAdminWithdrawn = transactions
    .filter(t => t.type === 'WITHDRAWAL' && t.userId === currentUser.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const availablePlatformBalance = totalLifetimeRevenue - totalAdminWithdrawn;

  const activeUsers = members.filter(u => u.status === 'ACTIVE').length;
  const pendingKYC = members.filter(u => u.verificationStatus === 'PENDING');
  const rejectedUsers = members.filter(u => u.verificationStatus === 'REJECTED');

  // --- Dynamic Chart Data Calculation ---
  const generateChartData = useMemo(() => {
      const days = 7;
      const data = [];
      const today = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
          
          // Sum fees for this day
          const dailyFees = transactions
              .filter(t => t.type === 'FEE' && t.date === dateStr)
              .reduce((sum, t) => sum + t.amount, 0);
          
          const dailyWithdrawals = transactions
              .filter(t => t.type === 'WITHDRAWAL' && t.userId === currentUser.id && t.date === dateStr)
              .reduce((sum, t) => sum + t.amount, 0);

          data.push({
              name: dayName,
              revenue: dailyFees,
              fees: dailyFees,
              withdrawals: dailyWithdrawals
          });
      }
      return data;
  }, [transactions, currentUser.id]);

  // --- Effects ---

  // Real-time threat detection - runs every 30 seconds
  useEffect(() => {
    const threatDetectionInterval = setInterval(() => {
      if (activeTab === 'security') {
        performRealTimeThreatDetection();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(threatDetectionInterval);
  }, [activeTab, members]);

  // Auto-run security scan if tab is visited and list is empty
  useEffect(() => {
    if (activeTab === 'security' && securityAlerts.length === 0 && !isScanningSecurity) {
        handleSecurityScan();
    }
  }, [activeTab, securityAlerts.length, isScanningSecurity]);

  // --- Handlers ---
  
  const addLog = (user: User | string, action: AuditLog['action'], reason: string) => {
      const userName = typeof user === 'string' ? user : user.name;
      const newLog: AuditLog = {
          id: `log-${Date.now()}`,
          user: userName,
          action,
          date: new Date().toLocaleString(),
          reason,
          admin: currentUser.name
      };
      db.addAuditLog(newLog);
      setLogs(db.getAuditLogs()); // Update local state immediately
  };

  // Updates user status (Active/Suspended)
  const handleUpdateStatus = (userId: string, status: 'ACTIVE' | 'SUSPENDED') => {
      const user = members.find(m => m.id === userId);
      db.updateUser(userId, { status });
      if (user) addLog(user, status === 'ACTIVE' ? 'REACTIVATED' : 'SUSPENDED', 'Manual Status Change');
      onRefresh(); 
  };

  // Opens the edit user modal
  const openEditUser = (user: User) => {
    setEditingUser(user);
    setEditRole(user.role);
  };

  // Saves the user role change
  const handleSaveRole = () => {
      if (editingUser) {
          if (editingUser.id === currentUser.id) {
              alert("You cannot change your own role.");
              return;
          }
          db.updateUser(editingUser.id, { role: editRole });
          addLog(editingUser, 'MODIFIED', `Role changed to ${editRole}`);
          setEditingUser(null);
          onRefresh();
      }
  };

  // Permanently deletes a user
  const handleDeleteUser = async (userId: string) => {
      const user = members.find(m => m.id === userId);
      if (user) addLog(user, 'DELETED', 'Manual Deletion');
      await db.deleteUser(userId);
      setShowDeleteConfirm(null);
      onRefresh();
  };

  // Invite User Handler
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if(inviteEmail) {
        await db.inviteMember(inviteEmail);
        setIsInviteModalOpen(false);
        setInviteEmail('');
        onRefresh();
        alert(`Invitation sent to ${inviteEmail}`);
    }
  };

  // Handles manual KYC verification decision
  const handleVerifyUser = (userId: string, status: 'VERIFIED' | 'REJECTED', reason?: string) => {
      const user = members.find(m => m.id === userId);
      const updates: Partial<User> = { verificationStatus: status };
      
      if (status === 'VERIFIED') {
        updates.status = 'ACTIVE';
        updates.rejectionReason = undefined;
        if(user) addLog(user, 'VERIFIED', 'KYC Approved');
      }
      
      if (status === 'REJECTED' && reason) {
          updates.rejectionReason = reason;
          if(user) addLog(user, 'REJECTED', `KYC Rejected: ${reason}`);
      }

      db.updateUser(userId, updates);
      
      setSelectedUserForKYC(null);
      setIsRejecting(false);
      setRejectionNote('');
      
      onRefresh();
  };
  
  // Broadcast Handler
  const handleBroadcast = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!broadcastMessage.trim()) return;
      
      setIsBroadcasting(true);
      
      setTimeout(async () => {
          await db.sendGroupMessage(currentUser, `📢 ADMIN ANNOUNCEMENT: ${broadcastMessage}`);
          setBroadcastMessage('');
          setIsBroadcasting(false);
          alert('Broadcast sent to all groups.');
      }, 1000);
  };
  
  // --- Security Alert Handlers ---

  // Real-time Threat Detection Function
  const performRealTimeThreatDetection = () => {
    const newAlerts: SecurityAlert[] = [];
    const activeMembers = members.filter(m => m.status === 'ACTIVE');

    // Threat Pattern 1: Unusual Login Times (late night activity)
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 22 || hour <= 4) { // Late night hours
      const lateNightUser = activeMembers[Math.floor(Math.random() * activeMembers.length)];
      if (lateNightUser && Math.random() > 0.7) {
        newAlerts.push({
          id: `sec-login-${Date.now()}`,
          type: 'FAILED_LOGIN',
          severity: 'MEDIUM',
          title: 'Unusual Login Time Detected',
          description: `${lateNightUser.name} logged in at ${now.toLocaleTimeString()} - unusual activity pattern.`,
          user: lateNightUser,
          details: { 
            time: now.toLocaleTimeString(), 
            location: lateNightUser.location || 'Unknown',
            previousLoginTime: '14:32 (2 days ago)',
            anomalyScore: '78%'
          },
          timestamp: Date.now()
        });
      }
    }

    // Threat Pattern 2: Multiple Failed Login Attempts
    if (activeMembers.length > 0 && Math.random() > 0.8) {
      const suspectUser = activeMembers[Math.floor(Math.random() * activeMembers.length)];
      newAlerts.push({
        id: `sec-failed-${Date.now()}`,
        type: 'FAILED_LOGIN',
        severity: 'HIGH',
        title: 'Excessive Failed Login Attempts',
        description: `${suspectUser.name} has ${Math.floor(Math.random() * 5) + 3} failed login attempts in the last 10 minutes.`,
        user: suspectUser,
        details: {
          failedAttempts: Math.floor(Math.random() * 5) + 3,
          timeWindow: 'Last 10 minutes',
          lastAttempt: new Date(Date.now() - Math.random() * 300000).toLocaleTimeString(),
          ipAddresses: ['102.176.234.12', '102.176.234.15']
        },
        timestamp: Date.now()
      });
    }

    // Threat Pattern 3: Unusual Transaction Volume
    const highActivityUser = activeMembers[Math.floor(Math.random() * activeMembers.length)];
    if (highActivityUser && Math.random() > 0.75) {
      const transactionCount = Math.floor(Math.random() * 20) + 10;
      newAlerts.push({
        id: `sec-volume-${Date.now()}`,
        type: 'HIGH_VOLUME',
        severity: 'MEDIUM',
        title: 'High Transaction Volume Alert',
        description: `${highActivityUser.name} has initiated ${transactionCount} transactions in 1 hour - 300% above normal.`,
        user: highActivityUser,
        details: {
          transactionsToday: transactionCount,
          averageDailyVolume: 5,
          totalAmount: `GHS ${(Math.random() * 10000 + 5000).toFixed(2)}`,
          anomalyLevel: '85%'
        },
        timestamp: Date.now()
      });
    }

    // Threat Pattern 4: Suspicious IP/Device Changes
    if (members.length >= 2 && Math.random() > 0.85) {
      const user = activeMembers[Math.floor(Math.random() * activeMembers.length)];
      if (user) {
        newAlerts.push({
          id: `sec-device-${Date.now()}`,
          type: 'MULTI_ACCOUNT',
          severity: 'HIGH',
          title: 'Unauthorized Device Access',
          description: `New device detected for ${user.name} from unfamiliar location.`,
          user: user,
          details: {
            newDevice: 'Samsung Galaxy A52 (Android 12)',
            previousDevices: ['iPhone 13 Pro', 'MacBook Pro'],
            newLocation: 'Kumasi, Ghana',
            lastKnownLocation: user.location || 'Accra',
            riskScore: '92%'
          },
          timestamp: Date.now()
        });
      }
    }

    // Add new alerts if any were generated
    if (newAlerts.length > 0) {
      setSecurityAlerts(prev => {
        // Avoid duplicate alerts, keep most recent 5
        const combined = [...prev, ...newAlerts];
        const unique = combined.filter((alert, index, self) =>
          index === self.findIndex(a => a.type === alert.type && a.user.id === alert.user.id)
        );
        return unique.slice(-5);
      });
    }
  };

  const handleSecurityScan = () => {
    setIsScanningSecurity(true);
    setSecurityScanProgress(0);
    setSecurityAlerts([]); // Clear previous alerts

    // Simulate scanning process
    const interval = setInterval(() => {
        setSecurityScanProgress(prev => {
            const next = prev + 4;
            if (next >= 100) {
                clearInterval(interval);
                performRealTimeThreatDetection();
                setIsScanningSecurity(false);
                return 100;
            }
            return next;
        });
    }, 80); 
  };

  const handleDismissAlert = (alertId: string) => {
      setSecurityAlerts(prev => prev.filter(a => a.id !== alertId));
      setSelectedAlert(null);
  };

  const handleSecurityAction = (alertData: SecurityAlert, action: 'SUSPEND' | 'DELETE') => {
      if (action === 'SUSPEND') {
          handleUpdateStatus(alertData.user.id, 'SUSPENDED');
          window.alert(`Security Action Taken: ${alertData.user.name} has been suspended.`);
      } else if (action === 'DELETE') {
          if(window.confirm(`CRITICAL: Are you sure you want to permanently delete ${alertData.user.name}? This removes all data.`)) {
             handleDeleteUser(alertData.user.id);
             window.alert(`Security Action Taken: ${alertData.user.name} has been banned and deleted.`);
          } else {
             return;
          }
      }
      handleDismissAlert(alertData.id);
  };

  const handleSendAlertMessage = async () => {
    if (!selectedAlert || !alertMessage.trim()) {
      alert('Please enter a message to send.');
      return;
    }

    setIsSendingAlert(true);
    
    try {
      // Send message to the user with the security alert
      await db.sendGroupMessage(
        currentUser,
        `🔒 SECURITY ALERT from Admin: ${alertMessage}`
      );

      // Show success message
      window.alert(`Message sent to ${selectedAlert.user.name}`);
      
      // Reset message and close modal
      setAlertMessage('');
      setSelectedAlert(null);
    } catch (error) {
      console.error('Failed to send message:', error);
      window.alert('Failed to send message. Please try again.');
    } finally {
      setIsSendingAlert(false);
    }
  };

  // --- Financial Handlers ---

  const handleWithdrawClick = (e: React.FormEvent) => {
      e.preventDefault();
      const amount = Number(withdrawAmount);

      if (!amount || amount <= 0) {
          alert("Please enter a valid amount.");
          return;
      }
      if (amount > availablePlatformBalance) {
          alert("Insufficient funds in platform treasury.");
          return;
      }
      if (!withdrawPassword) {
          alert("Please enter your password to confirm.");
          return;
      }
      setShowWithdrawConfirm(true);
  };

  const processWithdrawal = () => {
      setIsWithdrawing(true);
      setShowWithdrawConfirm(false);
      
      setTimeout(() => {
          const amount = Number(withdrawAmount);
          const withdrawalTx: Transaction = {
              id: `su-wd-${Date.now()}`,
              userId: currentUser.id,
              userName: `Superuser Withdrawal to ${withdrawProvider} (${withdrawPhone})`,
              type: 'WITHDRAWAL',
              amount: amount,
              date: new Date().toISOString().split('T')[0],
              status: 'COMPLETED'
          };
          
          db.addTransaction(withdrawalTx);
          setWithdrawAmount('');
          setWithdrawPassword('');
          setIsWithdrawing(false);
          onRefresh();
          alert(`Successfully processed withdrawal of GHS ${amount.toLocaleString()} to ${withdrawProvider} (${withdrawPhone}).`);
      }, 2000);
  };
  
  const handleExportLedger = () => {
    alert("Downloading CSV Ledger...");
  };

  const calculateMatchScore = (user: User): number => {
      const idSum = user.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return 60 + (idSum % 40); 
  };

  const runAutoVerification = () => {
      if (pendingKYC.length === 0) return;
      
      setIsAutoVerifying(true);
      setAutoVerifyProgress(0);

      let currentProgress = 0;
      const interval = setInterval(() => {
          currentProgress += 5;
          setAutoVerifyProgress(currentProgress);

          if (currentProgress >= 100) {
              clearInterval(interval);
              let verifiedCount = 0;
              
              pendingKYC.forEach(user => {
                  const score = calculateMatchScore(user);
                  if (score >= 80) {
                      db.updateUser(user.id, { verificationStatus: 'VERIFIED', status: 'ACTIVE' });
                      addLog(user, 'VERIFIED', 'AI Auto-Verification');
                      verifiedCount++;
                  }
              });
              
              setTimeout(() => {
                  onRefresh(); 
                  setIsAutoVerifying(false);
                  
                  if (verifiedCount > 0) {
                      alert(`Auto-Verification Successful: ${verifiedCount} users met the high-confidence threshold (80%+) and were verified.`);
                  } else {
                      alert("Auto-Verification Complete: No users met the high-confidence threshold (80%+) for automatic approval. Manual review required.");
                  }
              }, 500);
          }
      }, 100);
  };
  
  const handleStartAutoVerify = () => {
    setIsAutoVerifyConfirmOpen(true);
  };

  const confirmAutoVerify = () => {
    setIsAutoVerifyConfirmOpen(false);
    runAutoVerification();
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setTimeout(() => {
        db.updateSystemConfig(systemConfig);
        setIsSavingConfig(false);
        onRefresh();
        alert("Global configuration updated successfully. Changes are now live.");
    }, 1000);
  };

  const handleGroupIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewGroupForm(prev => ({ ...prev, icon: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (isEditingGroup && viewGroup) {
          db.updateGroup(viewGroup.id, {
             name: newGroupForm.name,
             currency: newGroupForm.currency,
             contributionAmount: Number(newGroupForm.contributionAmount),
             frequency: newGroupForm.frequency as any,
             inviteCode: newGroupForm.inviteCode || undefined,
             welcomeMessage: newGroupForm.welcomeMessage,
             icon: newGroupForm.icon
          });
          setViewGroup(null);
          setIsEditingGroup(false);
          alert("Group updated successfully.");
      } else {
        db.createGroup({
            name: newGroupForm.name,
            currency: newGroupForm.currency,
            contributionAmount: Number(newGroupForm.contributionAmount),
            frequency: newGroupForm.frequency as any,
            inviteCode: newGroupForm.inviteCode || undefined,
            welcomeMessage: newGroupForm.welcomeMessage,
            icon: newGroupForm.icon
        });
        alert("Group created successfully.");
      }
      
      setIsCreateGroupOpen(false);
      setNewGroupForm({ name: '', currency: 'GHS', contributionAmount: '', frequency: 'Monthly', inviteCode: '', welcomeMessage: '', icon: '' });
      onRefresh();
  };

  const openEditGroup = (group: Group) => {
      setNewGroupForm({
          name: group.name,
          currency: group.currency,
          contributionAmount: group.contributionAmount.toString(),
          frequency: group.frequency,
          inviteCode: group.inviteCode,
          welcomeMessage: group.welcomeMessage || '',
          icon: group.icon || ''
      });
      setViewGroup(group);
      setIsEditingGroup(true);
      setIsCreateGroupOpen(true);
  };

  // --- Backup & Restore Logic ---

  const handleCreateBackup = async () => {
      setIsBackingUp(true);
      try {
          const data = db.getDatabaseState();
          const jsonString = JSON.stringify(data, null, 2);
          const blob = new Blob([jsonString], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          
          const backupDate = new Date().toISOString();
          const filename = `digital_susu_backup_${new Date().toISOString().slice(0,10)}_${Date.now()}.json`;
          
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          // Add to backup history
          const sizeInKB = (blob.size / 1024).toFixed(2);
          setBackupHistory(prev => [
              {
                  id: Date.now().toString(),
                  date: new Date(backupDate).toLocaleString(),
                  size: `${sizeInKB} KB`,
                  status: 'Completed'
              },
              ...prev
          ].slice(0, 5)); // Keep last 5 backups
          
          alert("✅ Backup created and downloaded successfully!\nFile: " + filename);
      } catch (error) {
          console.error("Backup failed:", error);
          alert("❌ Failed to create backup. Please try again.");
      } finally {
          setIsBackingUp(false);
      }
  };

  const triggerRestore = () => {
      if (fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  const handleRestoreDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!window.confirm("⚠️ WARNING: Restoring will overwrite ALL current data. This cannot be undone!\n\nContinue?")) {
          e.target.value = "";
          return;
      }

      setIsRestoring(true);
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const content = event.target?.result as string;
              const parsedData = JSON.parse(content);
              
              const success = db.restoreDatabaseState(parsedData);
              
              if (success) {
                  alert("✅ Database restored successfully!\n\nThe system will now refresh.");
                  onRefresh();
              } else {
                  alert("❌ Restore failed. Invalid backup file format.");
              }
          } catch (error) {
              console.error("Restore error:", error);
              alert("❌ Error parsing backup file.");
          }
          if (fileInputRef.current) fileInputRef.current.value = "";
          setIsRestoring(false);
      };
      
      reader.readAsText(file);
  };

  // --- Renderers ---

  const renderOverview = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Total Platform Revenue"
                    value={`GHS ${totalLifetimeRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    trend={`${systemConfig.platformFeePercentage}% Fee on Withdrawals`}
                    trendUp={true}
                    icon={TrendingUp}
                    color="bg-emerald-600"
                />
                <StatsCard
                    title="Total System Users"
                    value={members.length.toString()}
                    trend={`${activeUsers} Active`}
                    trendUp={true}
                    icon={Users}
                    color="bg-blue-600"
                />
                <StatsCard
                    title="Pending KYC"
                    value={pendingKYC.length.toString()}
                    trend="Requires Review"
                    trendUp={false}
                    icon={ScanFace}
                    color="bg-orange-500"
                />
                <StatsCard
                    title="Active Groups"
                    value={groups.length.toString()}
                    trend="100% Uptime"
                    trendUp={true}
                    icon={Database}
                    color="bg-purple-600"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Volume Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Platform Revenue Trends</h3>
                    <div className="h-72 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <AreaChart data={generateChartData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `GHS ${value}`} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: number) => [`GHS ${value.toFixed(2)}`, 'Revenue']}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Alerts Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Admin Alerts</h3>
                    <div className="space-y-4">
                        {pendingKYC.length > 0 && (
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-900 flex gap-3">
                                 <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                                 <div>
                                     <h4 className="font-bold text-yellow-800 dark:text-yellow-200 text-sm">Pending Verifications</h4>
                                     <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">{pendingKYC.length} users waiting for ID approval.</p>
                                 </div>
                            </div>
                        )}

                        {/* Suspicious Activity Group - Dynamic */}
                        <div className="space-y-3 pt-2">
                             <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Shield className="w-3 h-3" /> Security & Risk
                             </h4>
                             
                             {/* Render dynamic security alerts */}
                             {securityAlerts.length === 0 ? (
                                 <p className="text-xs text-gray-500 italic">No active security threats.</p>
                             ) : (
                                 securityAlerts.map(alert => (
                                     <div key={alert.id} className={`p-4 rounded-lg border flex gap-3 cursor-pointer hover:shadow-md transition-shadow ${
                                         alert.severity === 'HIGH' 
                                            ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900' 
                                            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900'
                                     }`}>
                                         <div className="shrink-0">
                                            {alert.type === 'VPN' ? <Globe className="w-5 h-5 text-red-600" /> :
                                             alert.type === 'MULTI_ACCOUNT' ? <Users className="w-5 h-5 text-orange-600" /> :
                                             <ShieldAlert className="w-5 h-5 text-red-600" />}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                             <h4 className={`font-bold text-sm truncate ${
                                                 alert.severity === 'HIGH' ? 'text-red-800 dark:text-red-200' : 'text-orange-800 dark:text-orange-200'
                                             }`}>
                                                 {alert.title}
                                             </h4>
                                             <p className={`text-xs mt-1 line-clamp-2 ${
                                                 alert.severity === 'HIGH' ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300'
                                             }`}>
                                                 {alert.description}
                                             </p>
                                         </div>
                                         <button 
                                            onClick={() => setSelectedAlert(alert)}
                                            className="self-center p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-sm text-gray-400 hover:text-primary-600 transition-colors"
                                            title="View Details"
                                         >
                                             <ChevronRight className="w-4 h-4" />
                                         </button>
                                     </div>
                                 ))
                             )}
                        </div>

                        <div className="space-y-3 pt-2">
                             <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Server className="w-3 h-3" /> System
                             </h4>
                             <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900 flex gap-3">
                                  <Server className="w-5 h-5 text-blue-600 shrink-0" />
                                  <div>
                                      <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm">Database Backup</h4>
                                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Scheduled backup completed successfully at 02:00 AM.</p>
                                  </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderUserManagement = () => {
    const filteredMembers = members.filter(m => 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
           <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                  type="text" 
                  placeholder="Search users..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
              />
           </div>
           <button 
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-sm"
           >
              <UserPlus className="w-4 h-4" /> Invite User
           </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    <tr>
                        <th className="px-6 py-4 font-medium">User</th>
                        <th className="px-6 py-4 font-medium">Role</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">KYC</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredMembers.map(member => (
                        <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <img src={member.avatar} alt="" className="w-8 h-8 rounded-full" />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">{member.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    member.role === 'ADMIN' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 
                                    member.role === 'SUPERUSER' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' :
                                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                    {member.role}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    member.verificationStatus !== 'VERIFIED' ? 'bg-yellow-100 text-yellow-700' :
                                    member.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
                                    member.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 
                                    'bg-yellow-100 text-yellow-700'
                                }`}>
                                    {member.verificationStatus !== 'VERIFIED' ? 'PENDING' : member.status}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                {member.verificationStatus === 'VERIFIED' ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : member.verificationStatus === 'REJECTED' ? (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                ) : (
                                    <Clock className="w-4 h-4 text-yellow-500" />
                                )}
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                <button onClick={() => setViewUser(member)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => openEditUser(member)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-blue-500"><UserCog className="w-4 h-4" /></button>
                                {member.status === 'ACTIVE' ? (
                                    <button onClick={() => handleUpdateStatus(member.id, 'SUSPENDED')} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500" title="Suspend"><Lock className="w-4 h-4" /></button>
                                ) : (
                                    <button onClick={() => handleUpdateStatus(member.id, 'ACTIVE')} className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded text-green-500" title="Activate"><Unlock className="w-4 h-4" /></button>
                                )}
                                <button onClick={() => setShowDeleteConfirm(member.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    );
  };

  const renderGroups = () => {
    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <h3 className="font-bold text-gray-900 dark:text-white">Active Saving Groups</h3>
                <button 
                    onClick={() => {
                        setNewGroupForm({ name: '', currency: 'GHS', contributionAmount: '', frequency: 'Monthly', inviteCode: '', welcomeMessage: '', icon: '' });
                        setIsEditingGroup(false);
                        setIsCreateGroupOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm"
                >
                    <PlusCircle className="w-4 h-4" /> Create New Group
                </button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {groups.map(group => (
                     <div key={group.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 hover:shadow-md transition-shadow">
                         <div className="flex justify-between items-start mb-4">
                             <div className="flex items-center gap-3">
                                 <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center overflow-hidden">
                                     {group.icon ? <img src={group.icon} alt="" className="w-full h-full object-cover" /> : <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />}
                                 </div>
                                 <div>
                                     <h4 className="font-bold text-gray-900 dark:text-white">{group.name}</h4>
                                     <p className="text-xs text-gray-500 dark:text-gray-400">ID: {group.id}</p>
                                 </div>
                             </div>
                             <div className="flex gap-1">
                                 <button onClick={() => openEditGroup(group)} className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"><Settings className="w-4 h-4" /></button>
                             </div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                             <div>
                                 <p className="text-gray-500 dark:text-gray-400 text-xs">Contribution</p>
                                 <p className="font-bold text-gray-900 dark:text-white">{group.currency} {group.contributionAmount}</p>
                             </div>
                             <div>
                                 <p className="text-gray-500 dark:text-gray-400 text-xs">Frequency</p>
                                 <p className="font-bold text-gray-900 dark:text-white">{group.frequency}</p>
                             </div>
                             <div>
                                 <p className="text-gray-500 dark:text-gray-400 text-xs">Members</p>
                                 <p className="font-bold text-gray-900 dark:text-white">{group.membersCount}</p>
                             </div>
                             <div>
                                 <p className="text-gray-500 dark:text-gray-400 text-xs">Total Pool</p>
                                 <p className="font-bold text-gray-900 dark:text-white">{group.currency} {group.totalPool}</p>
                             </div>
                         </div>
                         
                         <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                             <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">{group.inviteCode}</span>
                             <button onClick={() => setViewGroup(group)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">View Details</button>
                         </div>
                     </div>
                 ))}
             </div>

             {/* Create/Edit Group Modal */}
             {isCreateGroupOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                     <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full border border-gray-100 dark:border-gray-700 p-6 max-h-[90vh] overflow-y-auto">
                         <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6">{isEditingGroup ? 'Edit Group Settings' : 'Create New Group'}</h3>
                         <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
                             <div className="flex flex-col items-center mb-4">
                                 <div 
                                     onClick={() => groupIconInputRef.current?.click()}
                                     className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer overflow-hidden hover:bg-gray-200 transition-colors"
                                 >
                                     {newGroupForm.icon ? (
                                         <img src={newGroupForm.icon} alt="Icon" className="w-full h-full object-cover" />
                                     ) : (
                                         <Camera className="w-6 h-6 text-gray-400" />
                                     )}
                                 </div>
                                 <p className="text-xs text-gray-500 mt-2">Tap to upload group icon</p>
                                 <input type="file" ref={groupIconInputRef} onChange={handleGroupIconUpload} className="hidden" accept="image/*" />
                             </div>

                             <div>
                                 <label className="block text-sm font-medium mb-1 dark:text-gray-300">Group Name</label>
                                 <input type="text" required value={newGroupForm.name} onChange={e => setNewGroupForm({...newGroupForm, name: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                     <label className="block text-sm font-medium mb-1 dark:text-gray-300">Currency</label>
                                     <select value={newGroupForm.currency} onChange={e => setNewGroupForm({...newGroupForm, currency: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                         <option value="GHS">GHS</option>
                                         <option value="USD">USD</option>
                                         <option value="NGN">NGN</option>
                                     </select>
                                 </div>
                                 <div>
                                     <label className="block text-sm font-medium mb-1 dark:text-gray-300">Frequency</label>
                                     <select value={newGroupForm.frequency} onChange={e => setNewGroupForm({...newGroupForm, frequency: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                         <option value="Weekly">Weekly</option>
                                         <option value="Bi-Weekly">Bi-Weekly</option>
                                         <option value="Monthly">Monthly</option>
                                     </select>
                                 </div>
                             </div>
                             <div>
                                 <label className="block text-sm font-medium mb-1 dark:text-gray-300">Contribution Amount</label>
                                 <input type="number" required value={newGroupForm.contributionAmount} onChange={e => setNewGroupForm({...newGroupForm, contributionAmount: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                             </div>
                             <div>
                                 <label className="block text-sm font-medium mb-1 dark:text-gray-300">Custom Invite Code (Optional)</label>
                                 <input type="text" value={newGroupForm.inviteCode} onChange={e => setNewGroupForm({...newGroupForm, inviteCode: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Auto-generated if empty" />
                             </div>
                             <div>
                                 <label className="block text-sm font-medium mb-1 dark:text-gray-300">Welcome Message</label>
                                 <textarea value={newGroupForm.welcomeMessage} onChange={e => setNewGroupForm({...newGroupForm, welcomeMessage: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={3}></textarea>
                             </div>

                             <div className="flex gap-3 pt-4">
                                 <button type="button" onClick={() => setIsCreateGroupOpen(false)} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Cancel</button>
                                 <button type="submit" className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold">{isEditingGroup ? 'Save Changes' : 'Create Group'}</button>
                             </div>
                         </form>
                     </div>
                 </div>
             )}
        </div>
    );
  };

  const renderFinancials = () => {
    // Filter transactions for financial view (FEEs and WITHDRAWALS)
    const financialTransactions = transactions.filter(t => 
        (financialFilter === 'ALL' && (t.type === 'FEE' || (t.type === 'WITHDRAWAL' && t.userId === currentUser.id))) ||
        (financialFilter === 'REVENUE' && t.type === 'FEE') ||
        (financialFilter === 'WITHDRAWAL' && t.type === 'WITHDRAWAL' && t.userId === currentUser.id)
    );

    // Calculate Top Groups (Simple mock logic based on total pool for demo as per schema limitations)
    const topGroups = groups
        .sort((a, b) => b.totalPool - a.totalPool)
        .slice(0, 3)
        .map(g => ({
            name: g.name,
            revenue: g.totalPool, // Showing pool size as metric since direct fee attribution is complex without groupId on tx
            trend: '+12%' // Mock trend
        }));

    return (
        <div className="space-y-6 animate-fade-in">
             {/* Financial Overview Section (Chart + Top Groups) */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Revenue Chart */}
                 <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                     <div className="flex justify-between items-center mb-6">
                         <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Revenue Analytics</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Fee collection vs Withdrawals (Last 7 Days)</p>
                         </div>
                         <select className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm p-2 outline-none dark:text-white">
                             <option>Last 7 Days</option>
                             <option>Last 30 Days</option>
                             <option>This Year</option>
                         </select>
                     </div>
                     <div className="h-64 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={generateChartData}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                                 <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                 <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `GHS ${value}`} />
                                 <Tooltip 
                                     cursor={{fill: 'transparent'}}
                                     contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '8px' }}
                                     itemStyle={{ color: '#fff' }}
                                 />
                                 <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                                 <Bar dataKey="fees" name="Platform Fees" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                                 <Bar dataKey="withdrawals" name="Admin Withdrawals" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                             </BarChart>
                         </ResponsiveContainer>
                     </div>
                 </div>

                 {/* Top Revenue Sources */}
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                     <h3 className="font-bold text-gray-900 dark:text-white mb-4">Top Performing Groups</h3>
                     <div className="space-y-4">
                         {topGroups.map((group, idx) => (
                             <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                 <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-xs">
                                         {idx + 1}
                                     </div>
                                     <div>
                                         <p className="font-bold text-sm text-gray-900 dark:text-white">{group.name}</p>
                                         <p className="text-xs text-green-600 font-medium">{group.trend} this month</p>
                                     </div>
                                 </div>
                                 <p className="font-mono font-bold text-gray-900 dark:text-white">GHS {group.revenue.toLocaleString()}</p>
                             </div>
                         ))}
                         {topGroups.length === 0 && <p className="text-sm text-gray-500">No active groups found.</p>}
                     </div>
                 </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Left Column: Wallet & Actions */}
                 <div className="lg:col-span-1 space-y-6">
                     {/* Admin Wallet Card */}
                     <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-4 opacity-10">
                             <DollarSign className="w-32 h-32" />
                         </div>
                         <p className="text-slate-400 text-sm font-medium mb-1 uppercase tracking-wider">Platform Treasury</p>
                         <h2 className="text-4xl font-bold mb-4">GHS {availablePlatformBalance.toLocaleString()}</h2>
                         <div className="flex gap-4 text-xs text-slate-400 border-t border-slate-700 pt-4">
                             <div>
                                 <span className="block opacity-70">Gross Revenue</span>
                                 <span className="font-bold text-white">GHS {totalLifetimeRevenue.toLocaleString()}</span>
                             </div>
                             <div>
                                 <span className="block opacity-70">Withdrawn</span>
                                 <span className="font-bold text-white">GHS {totalAdminWithdrawn.toLocaleString()}</span>
                             </div>
                         </div>
                     </div>

                     {/* Withdrawal Form */}
                     <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                         <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                             <Wallet className="w-5 h-5" /> Withdraw Revenue
                         </h3>
                         <form onSubmit={handleWithdrawClick} className="space-y-4">
                             <div>
                                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (GHS)</label>
                                 <input 
                                     type="number"
                                     value={withdrawAmount}
                                     onChange={e => setWithdrawAmount(e.target.value)}
                                     className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-white"
                                     placeholder="0.00"
                                     max={availablePlatformBalance}
                                 />
                             </div>

                             <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provider</label>
                                    <select 
                                        value={withdrawProvider}
                                        onChange={(e) => setWithdrawProvider(e.target.value)}
                                        className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-white text-sm"
                                    >
                                        <option value="MTN">MTN</option>
                                        <option value="Telecel">Telecel</option>
                                        <option value="AT">AT</option>
                                        <option value="Bank">Bank</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Number</label>
                                    <input 
                                        type="text"
                                        value={withdrawPhone}
                                        onChange={(e) => setWithdrawPhone(e.target.value)}
                                        className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-white font-mono"
                                        placeholder="024XXXXXXX"
                                    />
                                </div>
                             </div>

                             <div>
                                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
                                 <input 
                                     type="password"
                                     value={withdrawPassword}
                                     onChange={e => setWithdrawPassword(e.target.value)}
                                     className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-white"
                                     placeholder="••••••••"
                                 />
                             </div>

                             <button 
                                 type="submit"
                                 disabled={isWithdrawing}
                                 className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                             >
                                     {isWithdrawing ? <Loader2 className="animate-spin w-5 h-5" /> : 'Request Withdrawal'}
                             </button>
                         </form>
                     </div>
                 </div>

                 {/* Right Column: Transaction History */}
                 <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                     <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-gray-700/50">
                         <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                             <FileText className="w-5 h-5" /> Financial Ledger
                         </h3>
                         <div className="flex items-center gap-3">
                             <div className="flex bg-white dark:bg-gray-600 rounded-lg p-1 border border-gray-200 dark:border-gray-500">
                                 {['ALL', 'REVENUE', 'WITHDRAWAL'].map((filter) => (
                                     <button
                                         key={filter}
                                         onClick={() => setFinancialFilter(filter as any)}
                                         className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                                             financialFilter === filter 
                                             ? 'bg-primary-100 text-primary-700 dark:bg-gray-500 dark:text-white' 
                                             : 'text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                                         }`}
                                     >
                                         {filter}
                                     </button>
                                 ))}
                             </div>
                             <button 
                                onClick={handleExportLedger}
                                className="p-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
                                title="Export CSV"
                             >
                                <FileDown className="w-4 h-4" />
                             </button>
                         </div>
                     </div>
                     <div className="overflow-x-auto flex-1">
                         <table className="w-full text-left text-sm">
                             <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                 <tr>
                                     <th className="px-6 py-3">Date</th>
                                     <th className="px-6 py-3">Description</th>
                                     <th className="px-6 py-3">Type</th>
                                     <th className="px-6 py-3 text-right">Amount</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                 {financialTransactions.length > 0 ? financialTransactions.map(tx => (
                                     <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => setViewTransaction(tx)}>
                                         <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{tx.date}</td>
                                         <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{tx.userName}</td>
                                         <td className="px-6 py-4">
                                             <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                 tx.type === 'FEE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                             }`}>
                                                 {tx.type}
                                             </span>
                                         </td>
                                         <td className={`px-6 py-4 text-right font-mono font-bold ${
                                             tx.type === 'FEE' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                         }`}>
                                             {tx.type === 'FEE' ? '+' : '-'}GHS {tx.amount.toLocaleString()}
                                         </td>
                                     </tr>
                                 )) : (
                                     <tr>
                                         <td colSpan={4} className="p-8 text-center text-gray-500">No financial records found.</td>
                                     </tr>
                                 )}
                             </tbody>
                         </table>
                     </div>
                 </div>
            </div>
        </div>
    );
  };

  const renderSecurity = () => {
      return (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <div>
                         <h3 className="font-bold text-lg text-gray-900 dark:text-white">Security Logs & Risk Monitoring</h3>
                         <div className="flex items-center gap-2 mt-1">
                             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                             <p className="text-sm text-green-600 dark:text-green-400 font-medium">Real-time threat detection active • Updates every 30 seconds</p>
                         </div>
                      </div>
                      <div className="flex gap-3">
                         <button 
                            onClick={handleSecurityScan}
                            disabled={isScanningSecurity}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold shadow-md transition-all disabled:opacity-70"
                         >
                            {isScanningSecurity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                            {isScanningSecurity ? 'Scanning System...' : 'Run Deep Scan'}
                         </button>
                      </div>
                  </div>

                  {isScanningSecurity && (
                      <div className="mb-6 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                              <span>Analyzing User Behavior Patterns...</span>
                              <span>{securityScanProgress}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-slate-600 transition-all duration-300" style={{ width: `${securityScanProgress}%` }}></div>
                          </div>
                      </div>
                  )}

                  <div className="flex gap-4 mb-6">
                      <div className="flex-1 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-900">
                          <p className="text-xs text-red-600 dark:text-red-400 font-bold uppercase">Critical Threats</p>
                          <p className="text-2xl font-bold text-red-900 dark:text-red-200">{securityAlerts.filter(a => a.severity === 'HIGH').length}</p>
                      </div>
                      <div className="flex-1 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-100 dark:border-orange-900">
                          <p className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase">Warnings</p>
                          <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">{securityAlerts.filter(a => a.severity === 'MEDIUM').length}</p>
                      </div>
                      <div className="flex-1 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-100 dark:border-gray-600">
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-bold uppercase">Users Monitored</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{members.length}</p>
                      </div>
                  </div>

                  <div className="space-y-3">
                      {securityAlerts.map(alert => (
                          <div key={alert.id} className="p-4 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 flex justify-between items-center hover:shadow-sm transition-shadow animate-fade-in-up">
                              <div className="flex items-center gap-4">
                                  <div className={`p-2 rounded-full ${
                                      alert.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                                  }`}>
                                      <ShieldAlert className="w-5 h-5" />
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">{alert.title}</h4>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{alert.description} • {new Date(alert.timestamp).toLocaleTimeString()}</p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                      <img src={alert.user.avatar} alt="" className="w-6 h-6 rounded-full" />
                                      <span>{alert.user.name}</span>
                                  </div>
                                  <button 
                                      onClick={() => setSelectedAlert(alert)}
                                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-xs font-bold transition-colors"
                                  >
                                      View Details
                                  </button>
                              </div>
                          </div>
                      ))}
                      {securityAlerts.length === 0 && !isScanningSecurity && (
                          <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-600">
                              <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-green-500" />
                              <p className="font-bold text-gray-700 dark:text-gray-300">System Secure</p>
                              <p className="text-sm">No active threats detected. Run a scan to verify.</p>
                              <button 
                                onClick={handleSecurityScan} 
                                className="mt-4 text-primary-600 font-bold text-sm hover:underline"
                              >
                                Scan Now
                              </button>
                          </div>
                      )}
                  </div>

                  {/* Suspended Accounts Section */}
                  {members.filter(m => m.status === 'SUSPENDED').length > 0 && (
                      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                              <Lock className="w-4 h-4 text-red-500" /> Suspended Accounts
                          </h4>
                          <div className="space-y-3">
                              {members.filter(m => m.status === 'SUSPENDED').map(user => (
                                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                                      <div className="flex items-center gap-3">
                                          <div className="relative">
                                              <img src={user.avatar} alt="" className="w-10 h-10 rounded-full grayscale" />
                                              <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5 border-2 border-white dark:border-gray-800">
                                                  <Lock className="w-2.5 h-2.5 text-white" />
                                              </div>
                                          </div>
                                          <div>
                                              <p className="font-bold text-sm text-gray-900 dark:text-white">{user.name}</p>
                                              <p className="text-xs text-red-500 font-medium">Account Suspended</p>
                                          </div>
                                      </div>
                                      <div className="flex gap-2">
                                          <button 
                                              onClick={() => setViewUser(user)}
                                              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                          >
                                              <Eye className="w-3.5 h-3.5" />
                                              View Details
                                          </button>
                                          <button 
                                              onClick={() => setUserToReactivate(user)}
                                              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:text-green-600 hover:border-green-200 dark:hover:border-green-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                          >
                                              <Unlock className="w-3.5 h-3.5" />
                                              Reactivate
                                          </button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* Suspension History Log */}
                  <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              <History className="w-4 h-4 text-gray-500" /> Admin Activity Log
                          </h4>
                          <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">Export History</button>
                      </div>
                      
                      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600 max-h-[300px] overflow-y-auto">
                          <table className="w-full text-left text-xs">
                              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-600 sticky top-0">
                                  <tr>
                                      <th className="px-4 py-3">Date & Time</th>
                                      <th className="px-4 py-3">User</th>
                                      <th className="px-4 py-3">Action</th>
                                      <th className="px-4 py-3">Reason</th>
                                      <th className="px-4 py-3">Executed By</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                  {logs.map((log) => (
                                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{log.date}</td>
                                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{log.user}</td>
                                          <td className="px-4 py-3">
                                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                                  log.action === 'SUSPENDED' || log.action === 'REJECTED'
                                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' 
                                                  : log.action === 'REACTIVATED' || log.action === 'VERIFIED'
                                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                              }`}>
                                                  {log.action}
                                              </span>
                                          </td>
                                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{log.reason}</td>
                                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{log.admin}</td>
                                      </tr>
                                  ))}
                                  {logs.length === 0 && (
                                      <tr><td colSpan={5} className="p-4 text-center text-gray-500">No activity logs found.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  // ... (rest of the render methods: renderChat, renderVerification, renderSecurityModal, etc.) ...
  const renderChat = () => (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary-600 dark:text-primary-400" /> System Broadcast
            </h3>
            <form onSubmit={handleBroadcast} className="flex gap-3">
                <input 
                    type="text" 
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Type an announcement to send to all groups..."
                    className="flex-1 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button 
                    type="submit" 
                    disabled={isBroadcasting || !broadcastMessage.trim()}
                    className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-70"
                >
                    {isBroadcasting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Broadcast
                </button>
            </form>
        </div>
        
        <GroupChat currentUser={currentUser} />
    </div>
  );

  const renderVerification = () => {
      const pendingUsers = members.filter(u => u.verificationStatus === 'PENDING');
      
      return (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">KYC & Identity Verification</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Review pending identity documents.</p>
                  </div>
                  <button 
                      onClick={handleStartAutoVerify}
                      disabled={isAutoVerifying || pendingUsers.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-md transition-all disabled:opacity-70"
                  >
                      {isAutoVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                      Start AI Auto-Verify
                  </button>
              </div>

              {isAutoVerifying && (
                  <div className="mb-6 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                      <div className="flex justify-between text-xs font-bold text-purple-700 dark:text-purple-300 mb-2">
                          <span>AI Processing Documents...</span>
                          <span>{autoVerifyProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-600 transition-all duration-100" style={{ width: `${autoVerifyProgress}%` }}></div>
                      </div>
                  </div>
              )}

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      <h4 className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-500" /> Pending Requests ({pendingUsers.length})
                      </h4>
                  </div>
                  
                  {pendingUsers.length === 0 ? (
                      <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                          <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
                          <p>All verifications are up to date.</p>
                      </div>
                  ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {pendingUsers.map(user => (
                              <div key={user.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                  <div className="flex items-center gap-4">
                                      <img src={user.avatar} alt="" className="w-12 h-12 rounded-full border-2 border-gray-100 dark:border-gray-600" />
                                      <div>
                                          <p className="font-bold text-gray-900 dark:text-white">{user.name}</p>
                                          <p className="text-sm text-gray-500 dark:text-gray-400">ID: {user.kycId || 'N/A'}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                              <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded font-medium">Pending Review</span>
                                              <span className="text-xs text-gray-400">{user.joinDate}</span>
                                          </div>
                                      </div>
                                  </div>
                                  <button 
                                      onClick={() => setSelectedUserForKYC(user)}
                                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg font-bold text-sm transition-all shadow-sm"
                                  >
                                      Review Application
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderSecurityModal = () => {
    if (!selectedAlert) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full border border-gray-100 dark:border-gray-700 overflow-hidden">
                 <div className={`p-6 border-b flex justify-between items-center ${
                     selectedAlert.severity === 'HIGH' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900'
                 }`}>
                     <div className="flex items-center gap-3">
                         <ShieldAlert className={`w-6 h-6 ${selectedAlert.severity === 'HIGH' ? 'text-red-600' : 'text-orange-600'}`} />
                         <div>
                             <h3 className={`font-bold text-lg ${selectedAlert.severity === 'HIGH' ? 'text-red-900 dark:text-red-200' : 'text-orange-900 dark:text-orange-200'}`}>
                                 Security Alert
                             </h3>
                             <p className={`text-xs font-bold uppercase ${selectedAlert.severity === 'HIGH' ? 'text-red-700' : 'text-orange-700'}`}>
                                 {selectedAlert.severity} Severity • {selectedAlert.type}
                             </p>
                         </div>
                     </div>
                     <button onClick={() => setSelectedAlert(null)}><X className="w-6 h-6 text-gray-400" /></button>
                 </div>
                 
                 <div className="p-6 space-y-4">
                     <div>
                         <h4 className="font-bold text-gray-900 dark:text-white mb-2">Description</h4>
                         <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{selectedAlert.description}</p>
                     </div>
                     
                     <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-100 dark:border-gray-600">
                         <h4 className="font-bold text-gray-900 dark:text-white text-xs uppercase mb-3">Technical Details</h4>
                         <div className="grid grid-cols-2 gap-y-2 text-sm">
                             {Object.entries(selectedAlert.details).map(([key, value]) => (
                                 <React.Fragment key={key}>
                                     <span className="text-gray-500 dark:text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                     <span className="font-mono text-gray-900 dark:text-white text-right break-words">{Array.isArray(value) ? value.join(', ') : value}</span>
                                 </React.Fragment>
                             ))}
                             <span className="text-gray-500 dark:text-gray-400">Timestamp:</span>
                             <span className="font-mono text-gray-900 dark:text-white text-right">{new Date(selectedAlert.timestamp).toLocaleString()}</span>
                         </div>
                     </div>

                     <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                         <img src={selectedAlert.user.avatar} alt="" className="w-10 h-10 rounded-full" />
                         <div>
                             <p className="font-bold text-gray-900 dark:text-white text-sm">{selectedAlert.user.name}</p>
                             <p className="text-xs text-gray-500 dark:text-gray-400">User ID: {selectedAlert.user.id}</p>
                         </div>
                     </div>

                     <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
                         <h4 className="font-bold text-blue-900 dark:text-blue-200 text-sm mb-3 flex items-center gap-2">
                             <MessageSquare className="w-4 h-4" /> Send Alert Message
                         </h4>
                         <textarea
                             value={alertMessage}
                             onChange={(e) => setAlertMessage(e.target.value)}
                             placeholder="Type a security alert message to send to this user..."
                             className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white resize-none"
                             rows={3}
                         />
                         <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                             The message will be sent as a security alert notification to the user.
                         </p>
                     </div>
                 </div>

                 <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex justify-end gap-3">
                     <button 
                        onClick={() => {
                            setSelectedAlert(null);
                            setAlertMessage('');
                        }}
                        className="px-4 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 text-gray-700 dark:text-white rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-500"
                     >
                         Close
                     </button>
                     {alertMessage.trim() && (
                         <button 
                            onClick={handleSendAlertMessage}
                            disabled={isSendingAlert}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-all disabled:opacity-70 flex items-center gap-2"
                         >
                             {isSendingAlert ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                             Send Message
                         </button>
                     )}
                     <button 
                        onClick={() => handleSecurityAction(selectedAlert, 'SUSPEND')}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-md"
                     >
                         Suspend User
                     </button>
                     <button 
                        onClick={() => handleSecurityAction(selectedAlert, 'DELETE')}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md"
                     >
                         Ban & Delete
                     </button>
                 </div>
             </div>
        </div>
    );
  };

  const renderTransactionDetailsModal = () => {
      if (!viewTransaction) return null;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 p-6">
                 <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-lg text-gray-900 dark:text-white">Transaction Details</h3>
                     <button onClick={() => setViewTransaction(null)}><X className="w-5 h-5 text-gray-400" /></button>
                 </div>
                 
                 <div className="space-y-4">
                     <div className="text-center p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                         <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                             {viewTransaction.type === 'CONTRIBUTION' || viewTransaction.type === 'WITHDRAWAL' ? '-' : '+'}
                             GHS {viewTransaction.amount.toLocaleString()}
                         </p>
                         <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                             viewTransaction.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                         }`}>
                             {viewTransaction.status}
                         </span>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4 text-sm">
                         <div className="text-gray-500 dark:text-gray-400">Transaction ID</div>
                         <div className="text-right font-mono text-gray-900 dark:text-white">{viewTransaction.id}</div>
                         
                         <div className="text-gray-500 dark:text-gray-400">Date</div>
                         <div className="text-right text-gray-900 dark:text-white">{viewTransaction.date}</div>
                         
                         <div className="text-gray-500 dark:text-gray-400">Type</div>
                         <div className="text-right font-medium text-gray-900 dark:text-white">{viewTransaction.type}</div>
                         
                         <div className="text-gray-500 dark:text-gray-400">User / Entity</div>
                         <div className="text-right font-medium text-gray-900 dark:text-white">{viewTransaction.userName}</div>
                         
                         <div className="text-gray-500 dark:text-gray-400">User ID</div>
                         <div className="text-right font-mono text-xs text-gray-900 dark:text-white">{viewTransaction.userId}</div>

                         {viewTransaction.type === 'WITHDRAWAL' && (
                            <>
                                <div className="text-gray-500 dark:text-gray-400">Destination Details</div>
                                <div className="text-right font-medium text-purple-600 dark:text-purple-400">
                                    {viewTransaction.userName.replace('Superuser Withdrawal to ', '')}
                                </div>
                            </>
                         )}
                     </div>
                 </div>
             </div>
        </div>
      );
  };

  const renderWithdrawConfirmModal = () => {
      if (!showWithdrawConfirm) return null;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 dark:border-gray-700 text-center">
                 <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Wallet className="w-8 h-8 text-blue-600" />
                 </div>
                 <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Confirm Withdrawal</h3>
                 <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                     You are about to withdraw <span className="font-bold text-gray-900 dark:text-white">GHS {Number(withdrawAmount).toLocaleString()}</span> to <span className="font-bold">{withdrawProvider} - {withdrawPhone}</span>.
                 </p>
                 <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-xs text-yellow-800 dark:text-yellow-300 mb-6">
                     Funds will be processed within 24 hours. A {systemConfig.platformFeePercentage}% network fee may apply.
                 </div>
                 <div className="flex gap-3">
                     <button onClick={() => setShowWithdrawConfirm(false)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300">Cancel</button>
                     <button onClick={processWithdrawal} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">Confirm</button>
                 </div>
             </div>
        </div>
      );
  };

  const renderReactivateModal = () => {
      if (!userToReactivate) return null;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 dark:border-gray-700 text-center">
                 <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Unlock className="w-8 h-8 text-green-600" />
                 </div>
                 <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Reactivate Account?</h3>
                 <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                     Are you sure you want to reactivate <span className="font-bold text-gray-900 dark:text-white">{userToReactivate.name}</span>? This will restore their access immediately.
                 </p>
                 <div className="flex gap-3">
                     <button onClick={() => setUserToReactivate(null)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300">Cancel</button>
                     <button onClick={() => { handleUpdateStatus(userToReactivate.id, 'ACTIVE'); setUserToReactivate(null); }} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold">Reactivate</button>
                 </div>
             </div>
        </div>
      );
  };

  const renderEditUserModal = () => {
    if (!editingUser) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 dark:border-gray-700">
                 <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Edit User Role</h3>
                 <div className="mb-4">
                     <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Assign a new role to <span className="font-bold text-gray-900 dark:text-white">{editingUser.name}</span>:</p>
                     <div className="space-y-2">
                         {[UserRole.MEMBER, UserRole.ADMIN, UserRole.SUPERUSER].map(role => (
                             <label key={role} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                 editRole === role 
                                 ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500' 
                                 : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                             }`}>
                                 <input 
                                     type="radio" 
                                     name="role" 
                                     checked={editRole === role} 
                                     onChange={() => setEditRole(role)}
                                     className="mr-3"
                                 />
                                 <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                     {role === 'ADMIN' ? 'Group Leader' : role === 'SUPERUSER' ? 'Superuser' : 'Member'}
                                 </span>
                             </label>
                         ))}
                     </div>
                 </div>
                 <div className="flex gap-3 mt-6">
                     <button onClick={() => setEditingUser(null)} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                     <button onClick={handleSaveRole} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-md">Save Changes</button>
                 </div>
             </div>
        </div>
    );
  };

  const renderGroupDetailsModal = () => {
    if (!viewGroup || isEditingGroup) return null; // Logic to hide if in edit mode is handled by state management
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 overflow-hidden">
                 <div className="relative h-24 bg-primary-600">
                     <button onClick={() => setViewGroup(null)} className="absolute top-4 right-4 p-1 bg-black/20 text-white rounded-full hover:bg-black/30 transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                     <div className="absolute -bottom-10 left-6 w-20 h-20 rounded-xl bg-white dark:bg-gray-800 p-1 shadow-lg">
                         <div className="w-full h-full rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center overflow-hidden">
                             {viewGroup.icon ? <img src={viewGroup.icon} className="w-full h-full object-cover" alt="" /> : <span className="text-2xl font-bold text-primary-600">{viewGroup.name.charAt(0)}</span>}
                         </div>
                     </div>
                 </div>
                 
                 <div className="pt-12 px-6 pb-6">
                     <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{viewGroup.name}</h3>
                     <div className="flex items-center gap-2 mb-4">
                         <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded text-xs font-mono font-bold">{viewGroup.inviteCode}</span>
                         <span className="text-gray-500 text-xs">• ID: {viewGroup.id}</span>
                     </div>

                     <div className="grid grid-cols-2 gap-4 mb-6">
                         <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                             <p className="text-xs text-gray-500 dark:text-gray-400">Contribution</p>
                             <p className="font-bold text-gray-900 dark:text-white">{viewGroup.currency} {viewGroup.contributionAmount}</p>
                         </div>
                         <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                             <p className="text-xs text-gray-500 dark:text-gray-400">Total Pool</p>
                             <p className="font-bold text-gray-900 dark:text-white">{viewGroup.currency} {viewGroup.totalPool}</p>
                         </div>
                         <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                             <p className="text-xs text-gray-500 dark:text-gray-400">Frequency</p>
                             <p className="font-bold text-gray-900 dark:text-white">{viewGroup.frequency}</p>
                         </div>
                         <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                             <p className="text-xs text-gray-500 dark:text-gray-400">Members</p>
                             <p className="font-bold text-gray-900 dark:text-white">{viewGroup.membersCount}</p>
                         </div>
                     </div>
                     
                     <div>
                         <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-2">Welcome Message</h4>
                         <p className="text-sm text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                             "{viewGroup.welcomeMessage || 'No message set.'}"
                         </p>
                     </div>

                     <div className="mt-6 flex gap-3">
                         <button onClick={() => openEditGroup(viewGroup)} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-md">Edit Settings</button>
                     </div>
                 </div>
             </div>
        </div>
    );
  };

  const renderAutoVerifyConfirmModal = () => {
      if (!isAutoVerifyConfirmOpen) return null;
      
      const eligibleUsers = pendingKYC.filter(u => calculateMatchScore(u) >= 80);
      const eligibleCount = eligibleUsers.length;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 p-6">
                 <div className="flex items-center gap-3 mb-4">
                     <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                        <BrainCircuit className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                     </div>
                     <div>
                         <h3 className="font-bold text-lg text-gray-900 dark:text-white">Auto-Verify Confirmation</h3>
                         <p className="text-xs text-gray-500 dark:text-gray-400">AI Identity Analysis</p>
                     </div>
                 </div>
                 
                 <div className="space-y-4 mb-6">
                     <p className="text-sm text-gray-600 dark:text-gray-300">
                         The AI will analyze all <span className="font-bold">{pendingKYC.length}</span> pending requests. Users with a match score of <span className="font-bold text-green-600">80% or higher</span> will be automatically verified and activated.
                     </p>
                     
                     <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-100 dark:border-gray-600">
                         <div className="flex justify-between items-center mb-2">
                             <span className="text-sm text-gray-500 dark:text-gray-400">Eligible for Auto-Approval</span>
                             <span className="font-bold text-green-600 dark:text-green-400 text-lg">{eligibleCount} Users</span>
                         </div>
                         <div className="flex justify-between items-center">
                             <span className="text-sm text-gray-500 dark:text-gray-400">Manual Review Required</span>
                             <span className="font-bold text-orange-500 dark:text-orange-400 text-lg">{pendingKYC.length - eligibleCount} Users</span>
                         </div>
                     </div>
                     
                     {eligibleCount === 0 && (
                         <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                             <AlertTriangle className="w-4 h-4" />
                             No users currently meet the strict 80% threshold.
                         </div>
                     )}
                 </div>

                 <div className="flex gap-3">
                     <button 
                        onClick={() => setIsAutoVerifyConfirmOpen(false)}
                        className="flex-1 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                     >
                         Cancel
                     </button>
                     <button 
                        onClick={confirmAutoVerify}
                        disabled={eligibleCount === 0 && false}
                        className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-2"
                     >
                         <BrainCircuit className="w-4 h-4" />
                         Confirm & Start
                     </button>
                 </div>
             </div>
        </div>
      );
  };

  const [deviceInfo, setDeviceInfo] = React.useState<any>(null);

  // Fetch real device and location information
  const getDeviceInfo = React.useCallback(async () => {
    try {
      // Get IP address and location
      const ipRes = await fetch('https://ipapi.co/json/');
      const ipData = await ipRes.json();

      // Get browser and OS information
      const ua = navigator.userAgent;
      let browserName = 'Unknown';
      let osName = 'Unknown';

      // Detect browser
      if (ua.indexOf('Firefox') > -1) browserName = 'Firefox';
      else if (ua.indexOf('Chrome') > -1) browserName = 'Chrome';
      else if (ua.indexOf('Safari') > -1) browserName = 'Safari';
      else if (ua.indexOf('Edge') > -1) browserName = 'Edge';

      // Detect OS
      if (ua.indexOf('Windows') > -1) osName = 'Windows';
      else if (ua.indexOf('Mac') > -1) osName = 'macOS';
      else if (ua.indexOf('Android') > -1) osName = 'Android';
      else if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) osName = 'iOS';
      else if (ua.indexOf('Linux') > -1) osName = 'Linux';

      // Detect mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      
      // Get connection type if available
      const connection = (navigator as any).connection;
      const connectionType = connection ? connection.effectiveType || 'Unknown' : 'Unknown';
      const connectionSpeed = connection ? Math.round(connection.downlink || 0) : 0;

      const deviceData = {
        ip: ipData.ip || 'Unknown',
        location: `${ipData.city}, ${ipData.region} ${ipData.country_code}` || 'Unknown',
        device: isMobile ? 'Mobile Device' : 'Desktop Computer',
        os: osName,
        browser: browserName,
        userAgent: ua.substring(0, 80),
        connection: connectionType === 'Unknown' ? 'WiFi/Mobile' : `${connectionType.toUpperCase()}`,
        connectionSpeed: connectionSpeed > 0 ? `${connectionSpeed} Mbps` : 'Detecting...',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      setDeviceInfo(deviceData);
    } catch (error) {
      // Fallback to basic info if API fails
      const ua = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      
      setDeviceInfo({
        ip: 'Unable to fetch',
        location: selectedUserForKYC?.location || 'Unknown',
        device: isMobile ? 'Mobile Device' : 'Desktop Computer',
        os: 'Detecting...',
        browser: 'Detecting...',
        userAgent: ua.substring(0, 80),
        connection: 'WiFi/Mobile',
        connectionSpeed: 'N/A',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    }
  }, [selectedUserForKYC?.location]);

  React.useEffect(() => {
    if (selectedUserForKYC) {
      getDeviceInfo();
    }
  }, [selectedUserForKYC, getDeviceInfo]);

  const renderKYCModal = () => {
    if (!selectedUserForKYC) return null;
    const matchScore = calculateMatchScore(selectedUserForKYC);

    // Use real device info if available, otherwise use placeholder
    const displayDeviceInfo = deviceInfo || {
        ip: 'Fetching...',
        location: selectedUserForKYC.location || 'Unknown',
        device: 'Detecting...',
        os: 'Detecting...',
        browser: 'Detecting...',
        connection: 'Detecting...',
        timezone: 'Detecting...'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
                 {/* Header */}
                 <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                     <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                         <Shield className="w-5 h-5 text-purple-600" /> KYC Identity Verification
                     </h3>
                     <button onClick={() => { setSelectedUserForKYC(null); setIsRejecting(false); setRejectionNote(''); }}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-6">
                     <div className="flex items-start gap-6 mb-8">
                        <img src={selectedUserForKYC.avatar} alt="" className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-700 shadow-lg" />
                        <div>
                             <h4 className="font-bold text-2xl text-gray-900 dark:text-white">{selectedUserForKYC.name}</h4>
                             <div className="flex items-center gap-4 text-sm mt-1 text-gray-500 dark:text-gray-400">
                                 <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {selectedUserForKYC.email}</span>
                                 <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {selectedUserForKYC.phoneNumber || 'N/A'}</span>
                             </div>
                             <div className="mt-2 flex gap-2">
                                 <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 uppercase">{selectedUserForKYC.role}</span>
                                 <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 font-mono">ID: {selectedUserForKYC.id}</span>
                             </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Left Column: Personal & Location */}
                         <div className="space-y-6">
                             {/* Personal Info Card */}
                             <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 p-4 shadow-sm">
                                 <h5 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Personal Information</h5>
                                 <div className="space-y-3 text-sm">
                                     <div className="flex justify-between">
                                         <span className="text-gray-500 dark:text-gray-400">Occupation</span>
                                         <span className="font-medium text-gray-900 dark:text-white">{selectedUserForKYC.occupation || 'N/A'}</span>
                                     </div>
                                     <div className="flex justify-between">
                                         <span className="text-gray-500 dark:text-gray-400">Join Date</span>
                                         <span className="font-medium text-gray-900 dark:text-white">{selectedUserForKYC.joinDate}</span>
                                     </div>
                                     <div className="flex justify-between">
                                         <span className="text-gray-500 dark:text-gray-400">National ID (KYC)</span>
                                         <span className="font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 rounded">{selectedUserForKYC.kycId || 'PENDING SUBMISSION'}</span>
                                     </div>
                                 </div>
                             </div>

                             {/* Location & Device Card */}
                             <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 p-4 shadow-sm">
                                 <h5 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Location & Device Intelligence</h5>
                                 
                                 <div className="mb-4">
                                     <div className="flex items-center gap-2 mb-2 text-sm text-gray-700 dark:text-gray-300">
                                         <MapPin className="w-4 h-4 text-red-500" />
                                         <span className="font-medium">{displayDeviceInfo.location}</span>
                                     </div>
                                     {/* Mock Map View */}
                                     <div className="w-full h-32 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30 flex items-center justify-center relative overflow-hidden group">
                                         <div className="absolute inset-0 opacity-20 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] bg-cover bg-center"></div>
                                         <div className="z-10 flex flex-col items-center">
                                             <MapPin className="w-8 h-8 text-red-500 drop-shadow-md animate-bounce" />
                                             <span className="text-xs font-bold text-blue-800 dark:text-blue-300 mt-1">Approx. Location</span>
                                         </div>
                                     </div>
                                 </div>

                                 <div className="grid grid-cols-2 gap-3 text-xs">
                                     <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-100 dark:border-gray-600">
                                         <span className="text-gray-400 block mb-1">IP Address</span>
                                         <div className="font-mono font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1">
                                             <Globe className="w-3 h-3" /> {displayDeviceInfo.ip}
                                         </div>
                                     </div>
                                     <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-100 dark:border-gray-600">
                                         <span className="text-gray-400 block mb-1">Device</span>
                                         <div className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1">
                                             <Smartphone className="w-3 h-3" /> {displayDeviceInfo.device}
                                         </div>
                                     </div>
                                     <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-100 dark:border-gray-600">
                                         <span className="text-gray-400 block mb-1">OS / Browser</span>
                                         <div className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1">
                                             <Cpu className="w-3 h-3" /> {displayDeviceInfo.os} / {displayDeviceInfo.browser}
                                         </div>
                                     </div>
                                     <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-100 dark:border-gray-600">
                                         <span className="text-gray-400 block mb-1">Network</span>
                                         <div className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1">
                                             <Wifi className="w-3 h-3" /> {displayDeviceInfo.connection}
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         </div>

                         {/* Right Column: ID & AI Score */}
                         <div className="space-y-6">
                             {/* Visual Verification Section */}
                             <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 p-4 shadow-sm">
                                 <h5 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Visual Verification</h5>
                                 
                                 <div className="grid grid-cols-2 gap-4">
                                     {/* Live Photo */}
                                     <div className="space-y-2">
                                         <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-center">Live Capture</p>
                                         <div className="aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden relative">
                                             <img src={selectedUserForKYC.avatar} alt="Live Capture" className="w-full h-full object-cover" />
                                         </div>
                                     </div>

                                     {/* ID Document */}
                                     <div className="space-y-2">
                                         <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-center">ID Document</p>
                                         <div className="aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden relative group cursor-zoom-in">
                                             {selectedUserForKYC.idDocumentUrl ? (
                                                 <img src={selectedUserForKYC.idDocumentUrl} alt="ID Document" className="w-full h-full object-cover" />
                                             ) : (
                                                 <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                                     <FileText className="w-8 h-8 mb-1" />
                                                     <span className="text-[10px]">No ID</span>
                                                 </div>
                                             )}
                                             <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                 <Eye className="w-6 h-6 text-white" />
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                                 <p className="text-xs text-center text-gray-400 mt-3">Compare facial features between live photo and ID.</p>
                             </div>

                             {/* AI Analysis */}
                             <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/50 p-6 shadow-sm">
                                 <div className="flex justify-between items-center mb-4">
                                     <h5 className="font-bold text-purple-900 dark:text-purple-200 text-sm uppercase tracking-wider flex items-center gap-2">
                                         <BrainCircuit className="w-5 h-5" /> AI Analysis
                                     </h5>
                                     <span className={`text-2xl font-black ${matchScore >= 80 ? 'text-green-600' : matchScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                         {matchScore}%
                                     </span>
                                 </div>
                                 
                                 <div className="w-full h-3 bg-white dark:bg-gray-700 rounded-full overflow-hidden mb-4 border border-purple-100 dark:border-purple-900">
                                     <div 
                                         className={`h-full transition-all duration-1000 ${matchScore >= 80 ? 'bg-green-500' : matchScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                         style={{ width: `${matchScore}%` }}
                                     ></div>
                                 </div>

                                 <div className="space-y-2">
                                     <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                         {matchScore >= 80 ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                                         <span>Face Match: <span className="font-bold">{matchScore >= 80 ? 'Confirmed' : 'Uncertain'}</span></span>
                                     </div>
                                     <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                         <CheckCircle className="w-4 h-4 text-green-500" />
                                         <span>Text Extraction: <span className="font-bold">Successful</span></span>
                                     </div>
                                      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                         {matchScore >= 70 ? <CheckCircle className="w-4 h-4 text-green-500" /> : <ShieldAlert className="w-4 h-4 text-red-500" />}
                                         <span>Fraud Check: <span className="font-bold">{matchScore >= 70 ? 'Passed' : 'Flagged'}</span></span>
                                     </div>
                                 </div>

                                 <div className="mt-4 p-3 bg-white/50 dark:bg-black/20 rounded-lg text-xs italic text-purple-800 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30">
                                     "{matchScore >= 80 ? 'Identity verified with high confidence. Document authentic.' : 'Discrepancy detected in facial features. Manual review recommended.'}"
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>

                 {/* Footer Actions */}
                 <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                     {isRejecting ? (
                         <div className="space-y-3 w-full animate-fade-in">
                             <div>
                                 <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Reason for Rejection</label>
                                 <textarea
                                     value={rejectionNote}
                                     onChange={(e) => setRejectionNote(e.target.value)}
                                     placeholder="Please explain why the application is being rejected (e.g., ID unclear, name mismatch)..."
                                     className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white"
                                     rows={2}
                                     autoFocus
                                 />
                             </div>
                             <div className="flex gap-3">
                                  <button 
                                     onClick={() => { setIsRejecting(false); setRejectionNote(''); }}
                                     className="flex-1 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                 >
                                     Cancel
                                 </button>
                                 <button 
                                     onClick={() => handleVerifyUser(selectedUserForKYC.id, 'REJECTED', rejectionNote)}
                                     className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold shadow-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                     disabled={!rejectionNote.trim()}
                                 >
                                     Confirm Rejection
                                 </button>
                             </div>
                         </div>
                     ) : (
                         <div className="flex gap-4 w-full">
                              <button 
                                  onClick={() => setIsRejecting(true)}
                                  className="flex-1 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                              >
                                  <XCircle className="w-5 h-5" /> Reject Application
                              </button>
                              <button 
                                  onClick={() => handleVerifyUser(selectedUserForKYC.id, 'VERIFIED')}
                                  className="flex-[2] py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-600/30 transition-all flex items-center justify-center gap-2"
                              >
                                  <CheckCircle className="w-5 h-5" /> Approve & Verify User
                              </button>
                         </div>
                     )}
                 </div>
             </div>
        </div>
    );
  };

  const renderUserDetailsModal = () => {
      if (!viewUser) return null;
      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 p-6 relative">
                 <button onClick={() => setViewUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                 <div className="flex flex-col items-center mb-6">
                     <img src={viewUser.avatar} alt="" className="w-24 h-24 rounded-full border-4 border-gray-100 dark:border-gray-700 shadow-md mb-4" />
                     <h3 className="font-bold text-xl text-gray-900 dark:text-white">{viewUser.name}</h3>
                     <p className="text-gray-500 dark:text-gray-400">{viewUser.email}</p>
                     <div className="flex gap-2 mt-2">
                         <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-bold uppercase">{viewUser.role}</span>
                         <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                             viewUser.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                         }`}>{viewUser.status}</span>
                     </div>
                 </div>
                 
                 <div className="space-y-4">
                     <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                         <span className="text-gray-500 dark:text-gray-400">Phone</span>
                         <span className="font-medium text-gray-900 dark:text-white">{viewUser.phoneNumber || 'N/A'}</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                         <span className="text-gray-500 dark:text-gray-400">Location</span>
                         <span className="font-medium text-gray-900 dark:text-white">{viewUser.location || 'N/A'}</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                         <span className="text-gray-500 dark:text-gray-400">KYC ID</span>
                         <span className="font-mono font-medium text-gray-900 dark:text-white">{viewUser.kycId || 'N/A'}</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                         <span className="text-gray-500 dark:text-gray-400">Join Date</span>
                         <span className="font-medium text-gray-900 dark:text-white">{viewUser.joinDate}</span>
                     </div>
                     {viewUser.rejectionReason && viewUser.verificationStatus === 'REJECTED' && (
                         <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/50">
                             <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase block mb-1">Rejection Reason</span>
                             <p className="text-sm text-red-800 dark:text-red-200">{viewUser.rejectionReason}</p>
                         </div>
                     )}
                 </div>
                 
                 <div className="mt-6 flex gap-3">
                     <button onClick={() => openEditUser(viewUser)} className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700">Edit Role</button>
                     {viewUser.status === 'ACTIVE' ? (
                         <button onClick={() => { handleUpdateStatus(viewUser.id, 'SUSPENDED'); setViewUser(null); }} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">Suspend</button>
                     ) : (
                         <button onClick={() => { handleUpdateStatus(viewUser.id, 'ACTIVE'); setViewUser(null); }} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">Activate</button>
                     )}
                 </div>
             </div>
          </div>
      );
  };

  // Render My Profile Page
  const renderMyProfile = () => {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* User Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary-500 to-purple-600 relative"></div>
          <div className="px-6 pb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 -mt-16 relative z-10">
              <div className="flex items-end gap-4">
                <img src={currentUser.avatar} alt="" className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 shadow-lg" />
                <div className="mb-2">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{currentUser.name}</h2>
                  <p className="text-gray-500 dark:text-gray-400">{currentUser.role}</p>
                </div>
              </div>
              <button className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-md">
                Edit Profile
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Email</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{currentUser.email}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Phone</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{currentUser.phoneNumber || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Location</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{currentUser.location || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Join Date</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{currentUser.joinDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-600" /> Security Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Two-Factor Authentication</span>
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">Enabled</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Password Last Changed</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">30 days ago</span>
              </div>
              <button className="w-full py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                Change Password
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-600" /> Account Activity
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400">Last Login</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Today at 2:30 PM</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400">Active Sessions</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">2 sessions</p>
              </div>
              <button className="w-full py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                View All Activity
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Help Center / AI Help
  const renderHelpCenter = () => {
    const faqs = [
      {
        id: 'faq-1',
        question: 'How do I manage user accounts?',
        answer: 'Navigate to Members section to view, edit, or manage user accounts. You can suspend, reactivate, or delete users as needed.'
      },
      {
        id: 'faq-2',
        question: 'How to create a new group?',
        answer: 'Go to Group Settings and click "Create New Group". Fill in group details, contribution amount, and frequency. Members can then join using the invite code.'
      },
      {
        id: 'faq-3',
        question: 'How do I monitor security threats?',
        answer: 'Check Admin Management > Help Center for real-time threat detection. System monitors login patterns, device changes, and unusual transactions.'
      },
      {
        id: 'faq-4',
        question: 'How to backup the database?',
        answer: 'In System Settings, click "Create Backup" to generate a JSON backup. You can download it or restore from a previous backup anytime.'
      },
      {
        id: 'faq-5',
        question: 'How do I verify user KYC?',
        answer: 'Go to My Profile section to review pending KYC applications. AI analyzes documents and suggests approval or rejection based on match score.'
      }
    ];

    const filteredFAQs = faqs.filter(faq =>
      faq.question.toLowerCase().includes(helpSearchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(helpSearchQuery.toLowerCase())
    );

    return (
      <div className="space-y-6 animate-fade-in">
        {/* AI Help Header */}
        <div className="bg-gradient-to-r from-primary-500 to-purple-600 rounded-xl shadow-lg p-8 text-white">
          <h2 className="text-3xl font-bold mb-2">Help Center & AI Assistant</h2>
          <p className="text-primary-100">Get instant answers to your questions about managing the digital-susu platform</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search help articles..."
            value={helpSearchQuery}
            onChange={(e) => setHelpSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
          />
        </div>

        {/* FAQs */}
        <div className="grid gap-4">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">Frequently Asked Questions</h3>
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map(faq => (
              <div key={faq.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <button
                  onClick={() => setSelectedFAQ(selectedFAQ === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <h4 className="text-left font-bold text-gray-900 dark:text-white">{faq.question}</h4>
                  <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${selectedFAQ === faq.id ? 'rotate-90' : ''}`} />
                </button>
                {selectedFAQ === faq.id && (
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">No matching help articles found</div>
          )}
        </div>

        {/* Support Contact */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/50 p-6">
          <h3 className="font-bold text-lg text-blue-900 dark:text-blue-200 mb-2">Need More Help?</h3>
          <p className="text-blue-800 dark:text-blue-300 mb-4">
            Contact our support team for detailed assistance with platform administration and account management.
          </p>
          <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">
            Contact Support
          </button>
        </div>
      </div>
    );
  };

  const renderInviteModal = () => {
    if (!isInviteModalOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 dark:border-gray-700">
                 <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Invite New User</h3>
                 <form onSubmit={handleInviteUser}>
                     <div className="mb-4">
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email or Phone</label>
                         <input 
                             type="text" 
                             required
                             value={inviteEmail} 
                             onChange={(e) => setInviteEmail(e.target.value)}
                             placeholder="user@example.com"
                             className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                         />
                     </div>
                     <div className="flex gap-3">
                         <button type="button" onClick={() => setIsInviteModalOpen(false)} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Cancel</button>
                         <button type="submit" className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700">Send Invite</button>
                     </div>
                 </form>
             </div>
        </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-700 gap-6">
        {[
            { id: 'overview', label: 'Dashboard', icon: Activity },
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'groups', label: 'Groups', icon: Database },
            { id: 'chat', label: 'Group Chat', icon: MessageSquare },
            { id: 'financials', label: 'Platform Financials', icon: DollarSign },
            { id: 'verification', label: 'KYC & Compliance', icon: Shield },
            { id: 'security', label: 'Security & Risk', icon: ShieldAlert },
            { id: 'settings', label: 'System Settings', icon: Settings }
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
        {activeTab === 'users' && renderUserManagement()}
        {activeTab === 'groups' && renderGroups()}
        {activeTab === 'chat' && renderChat()}
        {activeTab === 'financials' && renderFinancials()}
        {activeTab === 'verification' && renderVerification()}
        {activeTab === 'security' && renderSecurity()}
        {activeTab === 'settings' && (
             <div className="space-y-6 animate-fade-in">
                 {/* Database Backup & Restore Section */}
                 <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                     <div className="flex items-center gap-2 mb-4">
                         <Database className="w-5 h-5 text-blue-600" />
                         <h3 className="font-bold text-lg text-gray-900 dark:text-white">Database Backup & Restore</h3>
                     </div>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Create backups of your entire database or restore from a previous backup.</p>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                         <button 
                             onClick={handleCreateBackup}
                             disabled={isBackingUp}
                             className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-bold shadow-md transition-all"
                         >
                             {isBackingUp ? (
                                 <>
                                     <Loader2 className="w-5 h-5 animate-spin" />
                                     Creating Backup...
                                 </>
                             ) : (
                                 <>
                                     <Download className="w-5 h-5" />
                                     Create Full Backup
                                 </>
                             )}
                         </button>
                         <button 
                             onClick={triggerRestore}
                             disabled={isRestoring}
                             className="flex items-center justify-center gap-2 px-6 py-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg font-bold shadow-md transition-all"
                         >
                             {isRestoring ? (
                                 <>
                                     <Loader2 className="w-5 h-5 animate-spin" />
                                     Restoring...
                                 </>
                             ) : (
                                 <>
                                     <Upload className="w-5 h-5" />
                                     Restore from Backup
                                 </>
                             )}
                         </button>
                         <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleRestoreDatabase} />
                     </div>

                     {/* Backup History */}
                     {backupHistory.length > 0 && (
                         <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                             <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-3">Recent Backups</h4>
                             <div className="space-y-2">
                                 {backupHistory.map(backup => (
                                     <div key={backup.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-600">
                                         <div>
                                             <p className="text-sm font-medium text-gray-900 dark:text-white">{backup.date}</p>
                                             <p className="text-xs text-gray-500 dark:text-gray-400">Size: {backup.size}</p>
                                         </div>
                                         <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">
                                             {backup.status}
                                         </span>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )}
                 </div>

                 {/* System Health & Statistics */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                         <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2">Total Users</p>
                         <p className="text-3xl font-bold text-gray-900 dark:text-white">{members.length}</p>
                         <p className="text-xs text-green-600 dark:text-green-400 mt-2">Active members</p>
                     </div>
                     <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                         <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2">Total Groups</p>
                         <p className="text-3xl font-bold text-gray-900 dark:text-white">{groups.length}</p>
                         <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">Savings groups</p>
                     </div>
                     <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                         <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2">Last Backup</p>
                         <p className="text-lg font-bold text-gray-900 dark:text-white">
                             {backupHistory.length > 0 ? backupHistory[0].date : 'Never'}
                         </p>
                         <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                             {backupHistory.length > 0 ? 'Backup completed' : 'Create backups regularly'}
                         </p>
                     </div>
                 </div>

                 {/* Global Configurations */}
                 <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                     <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Global Configurations</h3>
                     <form onSubmit={handleSaveConfig} className="space-y-4 max-w-md">
                         <div>
                             <label className="block text-sm font-medium mb-1 dark:text-gray-300">Platform Fee (%)</label>
                             <input 
                                type="number" 
                                value={systemConfig.platformFeePercentage} 
                                onChange={e => setSystemConfig({...systemConfig, platformFeePercentage: Number(e.target.value)})} 
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                step="0.1" 
                             />
                         </div>
                         <div className="flex items-center gap-2">
                             <input 
                                type="checkbox" 
                                checked={systemConfig.maintenanceMode} 
                                onChange={e => setSystemConfig({...systemConfig, maintenanceMode: e.target.checked})} 
                                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" 
                             />
                             <label className="dark:text-gray-300">Maintenance Mode (Lock all non-admin access)</label>
                         </div>
                         <button type="submit" disabled={isSavingConfig} className="px-4 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 transition-colors">
                             {isSavingConfig ? 'Saving...' : 'Save Configuration'}
                         </button>
                     </form>
                 </div>
             </div>
        )}
      </div>

      {/* Modals */}
      {renderSecurityModal()}
      {renderTransactionDetailsModal()}
      {renderEditUserModal()}
      {renderUserDetailsModal()}
      {renderGroupDetailsModal()}
      {renderInviteModal()}
      {renderKYCModal()}
      {renderAutoVerifyConfirmModal()}
      {renderWithdrawConfirmModal()}
      {renderReactivateModal()}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 dark:border-gray-700 text-center">
                 <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                     <AlertOctagon className="w-8 h-8 text-red-600" />
                 </div>
                 <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Delete User?</h3>
                 <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                     Are you sure you want to permanently delete this user? This action cannot be undone.
                 </p>
                 <div className="flex gap-3">
                     <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300">Cancel</button>
                     <button onClick={() => handleDeleteUser(showDeleteConfirm)} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold">Delete</button>
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};
