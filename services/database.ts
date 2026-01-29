
import { Group, Transaction, User, GroupMessage, UserRole, AuditLog, SystemConfig, GroupMembership } from '../types'; 

const API_BASE = '/api';

/**
 * PRODUCTION DATABASE SERVICE
 */
class DatabaseService {
  private groups: Group[] = [];
  private members: User[] = [];
  private transactions: Transaction[] = [];
  private messages: GroupMessage[] = [];
  private auditLogs: AuditLog[] = [];
  private memberships: GroupMembership[] = [];
  private isServerOnline: boolean | null = null;
  private systemConfig: SystemConfig = {
    defaultCurrency: 'GHS',
    defaultFrequency: 'Monthly',
    maintenanceMode: false,
    platformFeePercentage: 0.5
  };

  constructor() {
    this.syncData();
  }

  private isValidImage(str?: string): boolean {
      if (!str) return false;
      // Basic check for data URL or valid external URL
      return str.startsWith('data:image/') || str.startsWith('http');
  }

  private mapUser(u: any): User {
    if (!u) return {} as User;
    const name = u.name || 'Unknown';
    return {
      id: u.id || '',
      name: name,
      email: u.email || '',
      phoneNumber: u.phone_number || '',
      role: (u.role as UserRole) || UserRole.MEMBER,
      avatar: this.isValidImage(u.avatar) 
        ? u.avatar 
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`,
      occupation: u.occupation || '',
      location: u.location || '',
      kycId: u.kyc_id || '',
      status: u.status || 'NEW',
      verificationStatus: u.verification_status || 'UNVERIFIED',
      joinDate: u.join_date ? new Date(u.join_date).toISOString().split('T')[0] : '',
      reliabilityScore: u.reliability_score || 0,
      memberships: [] 
    };
  }

  private mapGroup(g: any): Group {
    if (!g) return {} as Group;
    
    let schedule = [];
    if (typeof g.payout_schedule === 'string') {
        try {
            schedule = JSON.parse(g.payout_schedule);
        } catch (e) {
            schedule = [];
        }
    } else if (Array.isArray(g.payout_schedule)) {
        schedule = g.payout_schedule;
    }

    return {
      id: g.id,
      name: g.name,
      contributionAmount: Number(g.contribution_amount || 0),
      currency: g.currency || 'GHS',
      frequency: g.frequency || 'Monthly',
      totalPool: Number(g.total_pool || 0),
      membersCount: Number(g.members_count || 0),
      cycleNumber: Number(g.cycle_number || 1),
      nextPayoutDate: g.next_payout_date ? new Date(g.next_payout_date).toISOString().split('T')[0] : '',
      inviteCode: g.invite_code || '',
      welcomeMessage: g.welcome_message || '',
      icon: this.isValidImage(g.icon) ? g.icon : '', 
      payoutSchedule: schedule, 
      reminderDaysBefore: 3,
      status: g.status || 'ACTIVE'
    };
  }

  private mapTransaction(t: any): Transaction {
    if (!t) return {} as Transaction;
    return {
      id: t.id || '',
      userId: t.user_id || '',
      userName: t.userName || 'System', 
      type: t.type || 'CONTRIBUTION',
      amount: Number(t.amount || 0),
      date: t.date ? new Date(t.date).toISOString().split('T')[0] : '',
      status: t.status || 'PENDING'
    };
  }

  async syncData(userId?: string): Promise<boolean> {
    try {
      const healthRes = await fetch(`${API_BASE}/check-health`, { 
          signal: AbortSignal.timeout(3000) 
      }).catch(() => null);
      
      if (!healthRes || !healthRes.ok) {
          this.isServerOnline = false;
          return false;
      }

      this.isServerOnline = true;
      
      const usersRes = await fetch(`${API_BASE}/users`);
      if (usersRes.ok) {
        const remoteUsers = await usersRes.json();
        this.members = Array.isArray(remoteUsers) ? remoteUsers.map((u: any) => this.mapUser(u)) : [];
      }

      const currentUser = userId ? this.members.find(m => m.id === userId) : null;

      if (userId) {
          if (currentUser && currentUser.role === UserRole.SUPERUSER) {
              const allGroupsRes = await fetch(`${API_BASE}/groups`);
              if (allGroupsRes.ok) {
                  const remoteGroups = await allGroupsRes.json();
                  this.groups = Array.isArray(remoteGroups) ? remoteGroups.map((g: any) => this.mapGroup(g)) : [];
              }
          } else {
              const groupsRes = await fetch(`${API_BASE}/users/${userId}/groups`);
              if (groupsRes.ok) {
                  const remoteGroups = await groupsRes.json();
                  this.groups = Array.isArray(remoteGroups) ? remoteGroups.map((g: any) => this.mapGroup(g)) : [];
              }
          }

          const txRes = await fetch(`${API_BASE}/transactions/${userId}`);
          if (txRes.ok) {
              const remoteTxs = await txRes.json();
              this.transactions = Array.isArray(remoteTxs) ? remoteTxs.map((t: any) => this.mapTransaction(t)) : [];
          }
      } else {
          const allGroupsRes = await fetch(`${API_BASE}/groups`);
          if (allGroupsRes.ok) {
              const remoteGroups = await allGroupsRes.json();
              this.groups = Array.isArray(remoteGroups) ? remoteGroups.map((g: any) => this.mapGroup(g)) : [];
          }
      }
      return true;
    } catch (error) {
      this.isServerOnline = false;
      return false;
    }
  }

  getServerStatus() {
      return this.isServerOnline;
  }

  async authenticate(email: string): Promise<User | undefined> {
    try {
        const res = await fetch(`${API_BASE}/users/${encodeURIComponent(email)}`, {
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
            const u = await res.json();
            const user = this.mapUser(u);
            await this.syncData(user.id);
            return user;
        }
    } catch (e) {
        console.warn("Server auth unreachable", e);
    }
    return this.members.find(m => m.email.toLowerCase() === email.toLowerCase());
  }

  async registerUser(user: User): Promise<User> {
    if (!this.isServerOnline) await this.syncData();
    if (this.isServerOnline) {
        try {
            const res = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    role: user.role,
                    avatar: user.avatar,
                    occupation: user.occupation,
                    location: user.location,
                    kycId: user.kycId
                })
            });
            if (res.ok) {
                await this.syncData(user.id);
                return user;
            }
        } catch (e) {
            throw new Error("Registration failed.");
        }
    }
    throw new Error("Server is offline.");
  }

  async inviteMember(emailOrPhone: string): Promise<boolean> {
    if (this.isServerOnline) {
        try {
            const res = await fetch(`${API_BASE}/users/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailOrPhone })
            });
            if (res.ok) {
                await this.syncData();
                return true;
            }
        } catch (e) {}
    }
    return false;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    if (this.isServerOnline) {
        try {
            const res = await fetch(`${API_BASE}/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) await this.syncData(userId);
        } catch (e) {}
    }
    return this.members.find(m => m.id === userId) || null;
  }

  async deleteUser(userId: string): Promise<boolean> {
    if (this.isServerOnline) {
        try {
            const res = await fetch(`${API_BASE}/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                await this.syncData();
                return true;
            }
        } catch (e) {}
    }
    return false;
  }

  async createGroup(data: Partial<Group> & { creatorId?: string }): Promise<Group> {
    const id = `g${Date.now()}`;
    const newGroupData = {
      id,
      name: data.name || 'New Group',
      contributionAmount: data.contributionAmount || 100,
      currency: data.currency || 'GHS',
      frequency: data.frequency || 'Monthly',
      inviteCode: data.inviteCode || `SUSU-${Math.floor(1000 + Math.random() * 9000)}`,
      welcomeMessage: data.welcomeMessage || '',
      icon: data.icon || '',
      creatorId: data.creatorId,
      status: 'PENDING_VERIFICATION'
    };

    if (this.isServerOnline) {
        try {
            await fetch(`${API_BASE}/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newGroupData)
            });
            await this.syncData(data.creatorId);
        } catch (e) {}
    }
    return this.mapGroup({
        id: newGroupData.id,
        name: newGroupData.name,
        contribution_amount: newGroupData.contributionAmount,
        currency: newGroupData.currency,
        frequency: newGroupData.frequency,
        invite_code: newGroupData.inviteCode,
        icon: newGroupData.icon,
        total_pool: 0,
        members_count: 1,
        status: newGroupData.status
    });
  }

  async updateGroup(groupId: string, data: Partial<Group>): Promise<Group | null> {
    if (this.isServerOnline) {
        try {
            const res = await fetch(`${API_BASE}/groups/${groupId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: data.name,
                    contributionAmount: data.contributionAmount,
                    currency: data.currency,
                    frequency: data.frequency,
                    welcomeMessage: data.welcomeMessage,
                    icon: data.icon,
                    payoutSchedule: data.payoutSchedule
                })
            });
            if (res.ok) {
                await this.syncData();
                return this.groups.find(g => g.id === groupId) || null;
            } else {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to update group settings on server.');
            }
        } catch (e: any) {
            console.error("Update group service failed", e);
            throw new Error(e.message || "Failed to update group settings.");
        }
    }
    throw new Error("Server is offline. Cannot update group settings.");
  }

  async updateGroupStatus(groupId: string, status: 'ACTIVE' | 'REJECTED'): Promise<Group | null> {
    if (this.isServerOnline) {
        try {
            const res = await fetch(`${API_BASE}/groups/${groupId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                await this.syncData();
                return this.groups.find(g => g.id === groupId) || null;
            }
        } catch (e) {}
    }
    return null;
  }

  async joinGroupRequest(userId: string, inviteCode: string): Promise<{ success: boolean, message: string }> {
    if (this.isServerOnline) {
        try {
            const res = await fetch(`${API_BASE}/groups/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, inviteCode })
            });
            const data = await res.json();
            if (res.ok) {
                await this.syncData(userId);
                return { success: true, message: "Request sent" };
            }
            return { success: false, message: data.message || "Failed to join" };
        } catch (e) {
            return { success: false, message: "Server connection failed" };
        }
    }
    return { success: false, message: "System offline." };
  }

  async addTransaction(transaction: Transaction, groupId?: string | null): Promise<void> {
    if (this.isServerOnline) {
        try {
            await fetch(`${API_BASE}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: transaction.id,
                    userId: transaction.userId,
                    type: transaction.type,
                    amount: transaction.amount,
                    status: transaction.status,
                    groupId: groupId || null
                })
            });
            await this.syncData(transaction.userId);
        } catch (e) {}
    }
  }

  getSystemConfig(): SystemConfig { return { ...this.systemConfig }; }
  getGroup(): Group | null { return this.groups[0] || null; }
  getGroups(): Group[] { return [...this.groups]; }
  getMembers(): User[] { return [...this.members]; }
  getTransactions(): Transaction[] { return [...this.transactions]; }
  
  async getGroupContributionTransactions(groupId: string): Promise<Transaction[]> {
    if (!this.isServerOnline) return [];
    try {
      const res = await fetch(`${API_BASE}/groups/${groupId}/transactions/contributions`, {
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const remoteTxs = await res.json();
        return Array.isArray(remoteTxs) ? remoteTxs.map((t: any) => this.mapTransaction(t)) : [];
      }
    } catch (e) {
      console.warn(`Failed to fetch contribution transactions for group ${groupId}:`, e);
    }
    return [];
  }
  
  async getGroupMessages(groupId?: string): Promise<GroupMessage[]> {
    const targetGroupId = groupId || this.groups[0]?.id;
    if (!targetGroupId) return this.messages;

    if (this.isServerOnline) {
      try {
        const res = await fetch(`${API_BASE}/group-messages/${targetGroupId}`, {
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
          const rows = await res.json();
          this.messages = rows.map((row: any) => ({
            id: row.id,
            senderId: row.sender_id,
            senderName: this.members.find(m => m.id === row.sender_id)?.name || 'Unknown',
            senderAvatar: this.members.find(m => m.id === row.sender_id)?.avatar || '',
            text: row.text,
            timestamp: Number(row.timestamp),
            type: row.type || 'text'
          }));
          return [...this.messages];
        }
      } catch (e) {
        console.warn("Failed to fetch messages from server", e);
      }
    }
    return [...this.messages];
  }
  
  getAuditLogs(): AuditLog[] { return [...this.auditLogs]; }
  getGroupsForUser(userId: string): Group[] { return this.groups; }
  getScopedUser(userId: string, groupId: string): User | null { return this.members.find(m => m.id === userId) || null; }
  addAuditLog(log: AuditLog): void { this.auditLogs.unshift(log); }
  updateSystemConfig(config: SystemConfig): void { this.systemConfig = config; }
  handleGoogleAuth(): User | null { return this.members.length > 0 ? this.members[0] : null; }
  getDatabaseState(): any { return { groups: this.groups, members: this.members, transactions: this.transactions }; }

  restoreDatabaseState(data: any): boolean {
    if (data.members) {
        this.members = data.members;
        this.groups = data.groups;
        return true;
    }
    return false;
  }

  async sendGroupMessage(sender: User, text: string, groupId?: string): Promise<GroupMessage> {
    const targetGroupId = groupId || this.groups[0]?.id;
    const msg: GroupMessage = {
      id: `m${Date.now()}`,
      senderId: sender.id,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      text,
      timestamp: Date.now(),
      type: 'text'
    };

    if (this.isServerOnline && targetGroupId) {
      try {
        const res = await fetch(`${API_BASE}/group-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: msg.id,
            groupId: targetGroupId,
            senderId: sender.id,
            text: text,
            type: 'text',
            timestamp: msg.timestamp
          })
        });
        if (res.ok) {
          this.messages.push(msg);
          return msg;
        }
      } catch (e) {
        console.warn("Failed to send message to server, using local cache", e);
        this.messages.push(msg);
        return msg;
      }
    }

    this.messages.push(msg);
    return msg;
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    if (this.isServerOnline) {
      try {
        const res = await fetch(`${API_BASE}/groups/${groupId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          this.groups = this.groups.filter(g => g.id !== groupId);
          return true;
        }
      } catch (e) {
        console.error("Delete group failed", e);
      }
    }
    return false;
  }

  async clearAllGroups(): Promise<boolean> {
    if (this.isServerOnline) {
      try {
        const groupIds = [...this.groups.map(g => g.id)];
        for (const groupId of groupIds) {
          await this.deleteGroup(groupId);
        }
        this.groups = [];
        return true;
      } catch (e) {
        console.error("Clear all groups failed", e);
      }
    }
    return false;
  }}

export const db = new DatabaseService();