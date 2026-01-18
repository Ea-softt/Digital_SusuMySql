

import { Group, Transaction, User, UserRole, Notification, GroupMessage } from './types';

export const MOCK_GROUP: Group = {
  id: 'g1',
  name: 'Family & Friends Circle',
  contributionAmount: 500,
  currency: 'GHS',
  frequency: 'Monthly',
  nextPayoutDate: '2024-06-01',
  cycleNumber: 3,
  totalPool: 5000,
  membersCount: 10,
  inviteCode: 'SUSU-2024-FAM',
  payoutSchedule: ['u1', 'u3', 'u4', 'u5', 'u2'],
  reminderDaysBefore: 3
};

const DEFAULT_MEMBERSHIP = {
    groupId: 'g1',
    groupName: 'Family & Friends Circle',
    joinDate: '2024-01-15'
};

export const MOCK_USER_MEMBER: User = {
  id: 'u1',
  name: 'Kwame Mensah',
  email: 'kwame@example.com',
  phoneNumber: '024 456 7890',
  role: UserRole.MEMBER,
  avatar: 'https://picsum.photos/150/150?random=1',
  occupation: 'Trader',
  location: 'Accra, Ghana',
  kycId: 'GHA-123456789-0',
  status: 'ACTIVE',
  joinDate: '2024-01-15',
  reliabilityScore: 98,
  verificationStatus: 'VERIFIED',
  idDocumentUrl: 'https://picsum.photos/400/250?random=101',
  preferences: {
    payout: 'coin',
    contribution: 'default',
    request: 'alert',
    system: 'chime'
  },
  memberships: [
      { ...DEFAULT_MEMBERSHIP, role: UserRole.MEMBER, status: 'ACTIVE' }
  ]
};

export const MOCK_USER_ADMIN: User = {
  id: 'u2',
  name: 'Ama Osei (Leader)',
  email: 'ama@example.com',
  phoneNumber: '050 123 4567',
  role: UserRole.ADMIN,
  avatar: 'https://picsum.photos/150/150?random=2',
  occupation: 'Teacher',
  location: 'Kumasi, Ghana',
  kycId: 'GHA-987654321-1',
  status: 'ACTIVE',
  joinDate: '2023-12-01',
  reliabilityScore: 100,
  verificationStatus: 'VERIFIED',
  idDocumentUrl: 'https://picsum.photos/400/250?random=102',
  preferences: {
    payout: 'coin',
    contribution: 'chime',
    request: 'alert',
    system: 'default'
  },
  memberships: [
      { ...DEFAULT_MEMBERSHIP, role: UserRole.ADMIN, status: 'ACTIVE' }
  ]
};

export const MOCK_USER_SUPERUSER: User = {
  id: 'u0',
  name: 'System Superuser',
  email: 'super@example.com',
  phoneNumber: '000 000 0000',
  role: UserRole.SUPERUSER,
  avatar: 'https://ui-avatars.com/api/?name=Super+User&background=111827&color=fff',
  occupation: 'System Administrator',
  location: 'Global Control Center',
  kycId: 'SYS-ADMIN-001',
  status: 'ACTIVE',
  joinDate: '2023-01-01',
  reliabilityScore: 100,
  verificationStatus: 'VERIFIED',
  preferences: {
    payout: 'default',
    contribution: 'default',
    request: 'alert',
    system: 'alert'
  },
  memberships: []
};

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 't1', userId: 'u1', userName: 'Kwame Mensah', type: 'CONTRIBUTION', amount: 500, date: '2024-05-01', status: 'COMPLETED' },
  { id: 't2', userId: 'u3', userName: 'John Doe', type: 'CONTRIBUTION', amount: 500, date: '2024-05-01', status: 'COMPLETED' },
  { id: 't3', userId: 'u2', userName: 'Ama Osei', type: 'CONTRIBUTION', amount: 500, date: '2024-05-02', status: 'COMPLETED' },
  { id: 't4', userId: 'u4', userName: 'Sarah Smith', type: 'CONTRIBUTION', amount: 500, date: '2024-05-03', status: 'PENDING' },
  { id: 't5', userId: 'u1', userName: 'Kwame Mensah', type: 'PAYOUT', amount: 5000, date: '2024-04-01', status: 'COMPLETED' },
  { id: 't6', userId: 'u6', userName: 'Pending User', type: 'CONTRIBUTION', amount: 500, date: '2024-05-05', status: 'PENDING' },
];

export const MOCK_MEMBERS: User[] = [
  MOCK_USER_SUPERUSER,
  MOCK_USER_MEMBER,
  MOCK_USER_ADMIN,
  { 
      id: 'u3', name: 'John Doe', email: 'john@test.com', phoneNumber: '024 111 2222', role: UserRole.MEMBER, avatar: 'https://picsum.photos/150/150?random=3', occupation: 'Driver', location: 'Tema', kycId: 'GHA-0000', status: 'ACTIVE', joinDate: '2024-02-01', reliabilityScore: 85, verificationStatus: 'VERIFIED', idDocumentUrl: 'https://picsum.photos/400/250?random=103',
      memberships: [{ ...DEFAULT_MEMBERSHIP, role: UserRole.MEMBER, status: 'ACTIVE' }]
  },
  { 
      id: 'u4', name: 'Sarah Smith', email: 'sarah@test.com', phoneNumber: '024 333 4444', role: UserRole.MEMBER, avatar: 'https://picsum.photos/150/150?random=4', occupation: 'Nurse', location: 'Accra', kycId: 'GHA-1111', status: 'ACTIVE', joinDate: '2024-02-10', reliabilityScore: 90, verificationStatus: 'VERIFIED', idDocumentUrl: 'https://picsum.photos/400/250?random=104',
      memberships: [{ ...DEFAULT_MEMBERSHIP, role: UserRole.MEMBER, status: 'ACTIVE' }]
  },
  { 
      id: 'u5', name: 'David Kojo', email: 'david@test.com', phoneNumber: '027 555 6666', role: UserRole.MEMBER, avatar: 'https://picsum.photos/150/150?random=5', occupation: 'Carpenter', location: 'Kasoa', kycId: 'GHA-2222', status: 'ACTIVE', joinDate: '2024-03-01', reliabilityScore: 75, verificationStatus: 'VERIFIED', idDocumentUrl: 'https://picsum.photos/400/250?random=105',
      memberships: [{ ...DEFAULT_MEMBERSHIP, role: UserRole.MEMBER, status: 'ACTIVE' }]
  },
  { 
      id: 'u6', name: 'Emmanuel Addo', email: 'emma@test.com', phoneNumber: '055 777 8888', role: UserRole.MEMBER, avatar: 'https://picsum.photos/150/150?random=6', occupation: 'Student', location: 'Legon', kycId: 'GHA-3333', status: 'PENDING', joinDate: '2024-05-15', reliabilityScore: 0, verificationStatus: 'PENDING', idDocumentUrl: 'https://picsum.photos/400/250?random=106',
      memberships: [{ ...DEFAULT_MEMBERSHIP, role: UserRole.MEMBER, status: 'PENDING' }]
  },
  // Add a Pending Group Leader for verification demo
  {
      id: 'u7', name: 'Rebecca Antwi', email: 'rebecca@test.com', phoneNumber: '020 999 0000', role: UserRole.ADMIN, avatar: 'https://picsum.photos/150/150?random=7', occupation: 'Business Owner', location: 'Takoradi', kycId: 'GHA-4444', status: 'NEW', joinDate: '2024-05-20', reliabilityScore: 0, verificationStatus: 'PENDING', idDocumentUrl: 'https://picsum.photos/400/250?random=107',
      memberships: []
  }
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  { 
    id: 'n1', 
    recipientId: 'u1', 
    title: 'Payment Successful', 
    message: 'Your contribution of GHS 500 has been confirmed.', 
    type: 'success', 
    timestamp: Date.now() - 1000 * 60 * 60 * 2, 
    read: false 
  },
  { 
    id: 'n2', 
    recipientId: 'u1', 
    title: 'Upcoming Payout', 
    message: 'Reminder: You are scheduled to receive the pot on June 1st.', 
    type: 'info', 
    timestamp: Date.now() - 1000 * 60 * 60 * 24, 
    read: true 
  },
  { 
    id: 'n3', 
    recipientId: 'ADMIN', 
    title: 'New Member Request', 
    message: 'Emmanuel Addo has requested to join the group. Please review their KYC.', 
    type: 'warning', 
    timestamp: Date.now() - 1000 * 60 * 30, 
    read: false 
  },
  { 
    id: 'n4', 
    recipientId: 'ADMIN', 
    title: 'Pending Contribution', 
    message: 'Sarah Smith has submitted a contribution that needs approval.', 
    type: 'warning', 
    timestamp: Date.now() - 1000 * 60 * 60 * 5, 
    read: false 
  },
  { 
    id: 'n5', 
    recipientId: 'ADMIN', 
    title: 'System Update', 
    message: 'Weekly reports are now available for download in the dashboard.', 
    type: 'info', 
    timestamp: Date.now() - 1000 * 60 * 60 * 48, 
    read: true 
  },
  { 
    id: 'n6', 
    recipientId: 'ALL', 
    title: 'Group Policy Update', 
    message: 'The contribution deadline has been moved to Fridays to ensure weekend payouts.', 
    type: 'info', 
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 3, 
    read: true 
  },
];

export const MOCK_GROUP_MESSAGES: GroupMessage[] = [
  {
    id: 'm1',
    senderId: 'u2',
    senderName: 'Ama Osei (Leader)',
    senderAvatar: 'https://picsum.photos/150/150?random=2',
    text: 'Welcome everyone to our new cycle! Let\'s aim for 100% on-time contributions this month.',
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2,
    type: 'text'
  },
  {
    id: 'm2',
    senderId: 'u3',
    senderName: 'John Doe',
    senderAvatar: 'https://picsum.photos/150/150?random=3',
    text: 'Thanks Ama. I will be sending mine on Friday.',
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 1,
    type: 'text'
  },
  {
    id: 'm3',
    senderId: 'u4',
    senderName: 'Sarah Smith',
    senderAvatar: 'https://picsum.photos/150/150?random=4',
    text: 'Has anyone used the new MoMo pay feature yet?',
    timestamp: Date.now() - 1000 * 60 * 60 * 5,
    type: 'text'
  },
  {
    id: 'm4',
    senderId: 'u1',
    senderName: 'Kwame Mensah',
    senderAvatar: 'https://picsum.photos/150/150?random=1',
    text: 'Yes Sarah, it works instantly. Much better than cash.',
    timestamp: Date.now() - 1000 * 60 * 60 * 4,
    type: 'text'
  }
];