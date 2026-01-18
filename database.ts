
import { Group, Transaction, User, GroupMessage, UserRole } from './types'; 
import { MOCK_GROUP, MOCK_MEMBERS, MOCK_TRANSACTIONS, MOCK_GROUP_MESSAGES } from './constants'; 

// MockDatabase class simulates a backend database service
class MockDatabase {
  // Private storage for application state
  private group: Group; // Main active group (for backward compatibility with existing components)
  private groups: Group[]; // List of all groups
  private members: User[];
  private transactions: Transaction[];
  private messages: GroupMessage[];

  constructor() {
    // MySQL database connection may be needed here
    // Details: Initialize your MySQL connection pool here (e.g., using 'mysql2/promise' createPool). Ensure env vars for HOST, USER, PASSWORD are loaded.

    // Initialize with mock data constants
    this.group = { ...MOCK_GROUP };
    this.groups = [this.group]; // Initialize with the default mock group
    this.members = [...MOCK_MEMBERS];
    this.transactions = [...MOCK_TRANSACTIONS];
    this.messages = [...MOCK_GROUP_MESSAGES];
  }

  // --- Getters ---
  
  // Returns the current main group object
  getGroup(): Group {
    // MySQL database connection may be needed here
    // Details: Execute SQL query: SELECT * FROM groups WHERE id = ? LIMIT 1;
    return this.group;
  }

  // Returns all groups
  getGroups(): Group[] {
      // MySQL database connection may be needed here
      // Details: Execute SQL query: SELECT * FROM groups;
      return this.groups;
  }

  // Returns the list of all members
  getMembers(): User[] {
    // MySQL database connection may be needed here
    // Details: Execute SQL query: SELECT * FROM users; (You might filter by group_id in a real app: SELECT u.* FROM users u JOIN user_groups ug ON u.id = ug.user_id WHERE ug.group_id = ?)
    return this.members;
  }

  // Returns the list of all transactions
  getTransactions(): Transaction[] {
    // MySQL database connection may be needed here
    // Details: Execute SQL query: SELECT * FROM transactions ORDER BY date DESC;
    return this.transactions;
  }

  // Returns the list of all group chat messages
  async getGroupMessages(): Promise<GroupMessage[]> {
    // MySQL database connection may be needed here
    // Details: Execute SQL query: SELECT * FROM messages WHERE group_id = ? ORDER BY timestamp ASC LIMIT 100;
    return this.messages;
  }

  // --- Actions ---

  // Creates a new group
  createGroup(data: Partial<Group>): Group {
      // MySQL database connection may be needed here
      // Details: Execute SQL query: INSERT INTO groups (name, currency, contribution_amount, frequency, invite_code, welcome_message, icon) VALUES (?, ?, ?, ?, ?, ?, ?);
      
      const newGroup: Group = {
          id: `g${Date.now()}`,
          name: data.name || 'New Savings Group',
          currency: data.currency || 'GHS',
          contributionAmount: data.contributionAmount || 100,
          frequency: data.frequency || 'Monthly',
          membersCount: 0,
          totalPool: 0,
          cycleNumber: 1,
          nextPayoutDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
          inviteCode: data.inviteCode || `SUSU-${Math.floor(1000 + Math.random() * 9000)}`,
          payoutSchedule: [],
          reminderDaysBefore: 3,
          welcomeMessage: data.welcomeMessage,
          icon: data.icon
      };
      this.groups.push(newGroup);

      if (data.welcomeMessage) {
        this.addSystemMessage(`[${newGroup.name}] ${data.welcomeMessage}`);
      }

      return newGroup;
  }

  // Update existing group settings
  updateGroup(groupId: string, data: Partial<Group>): Group | null {
      const index = this.groups.findIndex(g => g.id === groupId);
      if (index !== -1) {
          this.groups[index] = { ...this.groups[index], ...data };
          
          // Sync main group if it's the one being updated (for backward compatibility)
          if (this.group.id === groupId) {
              this.group = this.groups[index];
          }
          return this.groups[index];
      }
      return null;
  }
  
  // Registers a new user into the system
  registerUser(user: User): User {
    // MySQL database connection may be needed here
    // Details: Execute SQL query: INSERT INTO users (id, name, email, phone_number, role, avatar, status, join_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?);

    // Check for existing user by email
    const existing = this.members.find(m => m.email === user.email);
    if (existing) {
      return existing;
    }

    // Set initial verification status
    const newUserWithStatus = {
        ...user,
        verificationStatus: 'PENDING' as const, // Default to pending for new signups
    };

    // Add new user to the members array
    this.members = [newUserWithStatus, ...this.members];
    
    // Update the main group members count for consistency if they join main group logic
    // In this mock, we aren't strictly linking users to specific group IDs yet, but let's assume main group
    this.group.membersCount = this.members.length;
    
    // If registered as MEMBER, they start as NEW (need to join group)
    // If registered as ADMIN, they start as ACTIVE (creator)
    if (user.role === UserRole.ADMIN) {
        this.addSystemMessage(`${user.name} created the group.`);
    }
    
    return newUserWithStatus;
  }

  // Updates specific fields of a user profile
  updateUser(userId: string, updates: Partial<User>): User | null {
    // MySQL database connection may be needed here
    // Details: Execute SQL query: UPDATE users SET field = value, field2 = value2 WHERE id = ?;

    let updatedUser: User | null = null;
    this.members = this.members.map(member => {
      if (member.id === userId) {
        updatedUser = { ...member, ...updates };
        return updatedUser;
      }
      return member;
    });
    return updatedUser;
  }
  
  // Removes a user from the system
  deleteUser(userId: string): void {
      // MySQL database connection may be needed here
      // Details: Execute SQL query: DELETE FROM users WHERE id = ?; (Or use Soft Delete: UPDATE users SET deleted_at = NOW() WHERE id = ?;)

      this.members = this.members.filter(m => m.id !== userId);
      this.group.membersCount = this.members.length;
      // Also filter transactions for consistency in mock
      this.transactions = this.transactions.filter(t => t.userId !== userId);
  }

  // Admin invites a member (creates a placeholder profile)
  inviteMember(emailOrPhone: string): boolean {
    // MySQL database connection may be needed here
    // Details: Check existence: SELECT id FROM users WHERE email = ? OR phone = ?; If exists: UPDATE users SET status = 'INVITED'. If not: INSERT INTO users (...) VALUES (...);

    // Check if user exists in DB
    const existingUser = this.members.find(m => m.email === emailOrPhone || m.phoneNumber === emailOrPhone);
    
    if (existingUser) {
        if (existingUser.status === 'ACTIVE') return false; // Already active
        this.updateUser(existingUser.id, { status: 'INVITED' });
        return true;
    } 
    
    // Create a placeholder user if they don't exist
    const newUser: User = {
        id: `u${Date.now()}`,
        name: emailOrPhone.split('@')[0] || 'Invited Member',
        email: emailOrPhone.includes('@') ? emailOrPhone : '',
        phoneNumber: !emailOrPhone.includes('@') ? emailOrPhone : '',
        role: UserRole.MEMBER,
        avatar: `https://ui-avatars.com/api/?name=Invited&background=random`,
        status: 'INVITED',
        joinDate: new Date().toISOString().split('T')[0],
        reliabilityScore: 0,
        verificationStatus: 'UNVERIFIED',
        preferences: {
            payout: 'default',
            contribution: 'default',
            request: 'default',
            system: 'default'
        }
    };
    this.members = [newUser, ...this.members];
    return true;
  }

  // Processes a user's request to join a group via code
  joinGroupRequest(userId: string, code: string): { success: boolean, message: string } {
      // MySQL database connection may be needed here
      // Details: Step 1: SELECT id FROM groups WHERE invite_code = ?. Step 2: If found, INSERT INTO user_groups (user_id, group_id, status) VALUES (?, ?, 'PENDING');

      // Check all groups for code match
      const targetGroup = this.groups.find(g => g.inviteCode === code || g.name.toLowerCase() === code.toLowerCase());

      if (!targetGroup) {
          return { success: false, message: 'Invalid Group Code or Name' };
      }
      
      this.updateUser(userId, { status: 'PENDING' });
      this.addSystemMessage(`New join request received for ${targetGroup.name}.`);
      return { success: true, message: 'Request sent to Admin' };
  }

  // Records a new transaction (Contribution, Payout, etc.)
  addTransaction(transaction: Transaction): void {
    // MySQL database connection may be needed here
    // Details: Execute SQL Transaction: 1. INSERT INTO transactions (...) VALUES (...); 2. UPDATE groups SET total_pool = total_pool + ? WHERE id = ?;

    this.transactions = [transaction, ...this.transactions];
    
    // Update pool balance based on transaction type for the main group
    // In a multi-group system, we would need transaction.groupId
    if (transaction.type === 'CONTRIBUTION' && transaction.status === 'COMPLETED') {
        this.group.totalPool += transaction.amount;
    } else if (transaction.type === 'PAYOUT' && transaction.status === 'COMPLETED') {
        this.group.totalPool = Math.max(0, this.group.totalPool - transaction.amount);
    } else if (transaction.type === 'WITHDRAWAL' && transaction.status === 'COMPLETED') {
        // Withdrawal logic handled in dashboard state usually, but good to log
    }
  }

  // Sends a message to the group chat
  async sendGroupMessage(sender: User, text: string): Promise<GroupMessage> {
    // MySQL database connection may be needed here
    // Details: Execute SQL query: INSERT INTO messages (sender_id, group_id, text, type, timestamp) VALUES (?, ?, ?, 'text', NOW());

    const newMessage: GroupMessage = {
      id: `m${Date.now()}`,
      senderId: sender.id,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      text: text,
      timestamp: Date.now(),
      type: 'text'
    };
    this.messages = [...this.messages, newMessage];
    return newMessage;
  }

  // Internal helper to add system notifications to chat
  private addSystemMessage(text: string): void {
    // MySQL database connection may be needed here
    // Details: Execute SQL query: INSERT INTO messages (sender_id, text, type, timestamp) VALUES ('SYSTEM', ?, 'system', NOW());

    const sysMsg: GroupMessage = {
      id: `sys${Date.now()}`,
      senderId: 'SYSTEM',
      senderName: 'System',
      senderAvatar: '',
      text: text,
      timestamp: Date.now(),
      type: 'system'
    };
    this.messages = [...this.messages, sysMsg];
  }

  // Authenticates a user by email (Simple mock implementation)
  authenticate(email: string): User | undefined {
    // MySQL database connection may be needed here
    // Details: Execute SQL query: SELECT * FROM users WHERE email = ? LIMIT 1; (Then compare password hashes).
    return this.members.find(m => m.email.toLowerCase() === email.toLowerCase());
  }

  // --- Backup & Restore Functionality ---

  /**
   * Exports the entire database state as a single object.
   * Useful for creating backups.
   */
  getDatabaseState() {
      // MySQL database connection may be needed here
      // Details: Execute multiple SELECT queries to gather all data from tables (users, groups, transactions) and structure it into a JSON object.
      return {
          group: this.group,
          groups: this.groups,
          members: this.members,
          transactions: this.transactions,
          messages: this.messages,
          timestamp: new Date().toISOString(),
          version: '1.0'
      };
  }

  /**
   * Restores the database state from a backup object.
   * Validates the structure before applying.
   * @param data The parsed JSON object from a backup file
   * @returns boolean indicating success or failure
   */
  restoreDatabaseState(data: any): boolean {
      // MySQL database connection may be needed here
      // Details: Execute TRUNCATE TABLE on relevant tables, then loop through the JSON data and execute INSERT statements to restore data.
      try {
          // Basic validation to ensure critical data structures exist
          if (data.group && Array.isArray(data.members) && Array.isArray(data.transactions)) {
              this.group = data.group;
              this.groups = data.groups || [data.group]; // Restore groups list or fallback
              this.members = data.members;
              this.transactions = data.transactions;
              this.messages = data.messages || []; // optional, default to empty if missing
              return true;
          }
          console.error("Invalid backup format: Missing required fields");
          return false;
      } catch (e) {
          console.error("Failed to restore DB:", e);
          return false;
      }
  }
}

// Export a singleton instance of the database
export const db = new MockDatabase();
