
/* 
 * TYPES.TS - THE BLUEPRINT / DATA MODEL
 * -------------------------------------
 * This file defines the "Shape" of all data in your application.
 * Think of this as the dictionary or the rules for your data.
 * 
 * HOW TO USE:
 * 1. If you want to add a "Date of Birth" to a user, add `dob?: string;` to the User interface.
 * 2. If you want to add a new type of transaction (e.g., "LOAN"), add it to the Transaction interface.
 */

// Roles define what a user is allowed to do.
export enum UserRole {
  MEMBER = 'MEMBER', // Can pay and view their own data.
  ADMIN = 'ADMIN',   // Group Leader - Can manage members and settings.
  SUPERUSER = 'SUPERUSER', // System Owner - Can see everything.
}

// Defines available sound types for notifications
export type SoundType = 'default' | 'chime' | 'coin' | 'alert';

// Settings for user notifications
export interface NotificationPreferences {
  payout: SoundType;
  contribution: SoundType;
  request: SoundType;
  system: SoundType;
}

// Global system configuration (Superuser settings)
export interface SystemConfig {
  defaultCurrency: string;
  defaultFrequency: string;
  maintenanceMode: boolean; // If true, only admins can log in
  platformFeePercentage: number; // The cut the platform takes
}

// A user can be part of multiple groups. This tracks their status in ONE specific group.
export interface GroupMembership {
  groupId: string;
  groupName: string;
  role: UserRole;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INVITED' | 'NEW';
  joinDate: string;
  reliabilityScore?: number;
}

// The Main User Object
// If you add a field here, you must update the registration form in App.tsx
export interface User {
  id: string; // Unique ID (e.g., 'u1')
  name: string;
  email: string;
  phoneNumber?: string; // The '?' means this field is optional
  role: UserRole; // This is their "Global" role or current context role
  avatar: string; // URL to image
  occupation?: string;
  location?: string;
  kycId?: string; // National ID number
  
  // Status controls access. 
  // PENDING = Waiting for admin approval. 
  // NEW = Registered but hasn't joined a group.
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INVITED' | 'NEW'; 
  
  joinDate: string;
  reliabilityScore?: number; // 0-100%, calculated based on payment history
  preferences?: NotificationPreferences;
  
  // KYC (Know Your Customer) fields
  verificationStatus?: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'UNVERIFIED';
  idDocumentUrl?: string;
  rejectionReason?: string;
  
  // Auth & Security
  twoFactorEnabled?: boolean;
  authProvider?: 'email' | 'google';
  
  // List of all groups this user belongs to
  memberships?: GroupMembership[]; 
}

// Defines a Savings Group (The Susu Circle)
export interface Group {
  id: string;
  name: string;
  contributionAmount: number; // How much everyone pays per cycle
  currency: string; // e.g., 'GHS', 'USD'
  frequency: 'Weekly' | 'Monthly' | 'Bi-Weekly';
  nextPayoutDate: string;
  cycleNumber: number; // Which rotation are they on?
  totalPool: number; // Current money in the pot
  membersCount: number;
  inviteCode: string; // Code to join
  payoutSchedule: string[]; // Array of User IDs describing who gets paid 1st, 2nd, 3rd...
  reminderDaysBefore: number; 
  welcomeMessage?: string;
  icon?: string;
}

// Any money movement is a Transaction
export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  type: 'CONTRIBUTION' | 'PAYOUT' | 'WITHDRAWAL' | 'DEPOSIT' | 'FEE';
  amount: number;
  date: string; // ISO String YYYY-MM-DD
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}

// AI Chat Messages
export interface ChatMessage {
  id: string;
  role: 'user' | 'model'; // 'model' is the AI
  text: string;
  timestamp: number;
}

// Internal Group Chat Messages
export interface GroupMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
  type: 'text' | 'system'; // 'system' messages are automatic alerts (e.g., "John joined")
}

// Pop-up alerts
export interface Notification {
  id: string;
  recipientId: string; // 'ADMIN', 'ALL', or specific userId
  title: string;
  message: string;
  type: 'success' | 'warning' | 'info' | 'error';
  timestamp: number;
  read: boolean;
}

// Logs for the Superuser to track critical actions
export interface AuditLog {
  id: string;
  user: string;
  action: 'SUSPENDED' | 'REACTIVATED' | 'DELETED' | 'VERIFIED' | 'REJECTED' | 'MODIFIED';
  date: string;
  reason: string;
  admin: string;
}