import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { Mail, User as UserIcon, AlertCircle, CheckCircle, Loader2, Phone, MapPin, Briefcase, ArrowLeft, Calendar, Shield, TrendingUp, Search, Edit2, Save, X } from 'lucide-react';
import { db } from '../services/database';

interface CreateUserProfileProps {
  userId?: string;
  onCancel?: () => void;
}

export const CreateUserProfile: React.FC<CreateUserProfileProps> = ({ userId, onCancel }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState(userId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<User>>({});
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load users list on mount
  useEffect(() => {
    loadUsersList();
  }, []);

  // Load specific user when userId changes
  useEffect(() => {
    if (selectedUserId) {
      loadUserData(selectedUserId);
    }
  }, [selectedUserId]);

  const loadUsersList = () => {
    try {
      const allMembers = db.getMembers();
      setUsers(allMembers);
      setMessage(null);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load users list.' });
      console.error('Error loading users:', error);
    }
  };

  const loadUserData = async (userId: string) => {
    setIsLoading(true);
    try {
      const allMembers = db.getMembers();
      const foundUser = allMembers.find(u => u.id === userId);
      
      if (foundUser) {
        setUser(foundUser);
        setEditFormData(foundUser);
        setMessage(null);
      } else {
        setUser(null);
        setMessage({ type: 'error', text: 'User not found in the database.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load user data.' });
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!user || !editFormData) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Update user in database
      db.updateUser(user.id, editFormData);
      
      // Update local state
      setUser({...user, ...editFormData});
      setIsEditMode(false);
      setSaveMessage({ type: 'success', text: 'User profile updated successfully!' });
      
      // Reload users list to reflect changes
      loadUsersList();
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to save changes. Please try again.' });
      console.error('Error saving user:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show user details if userId is selected and user is loaded
  if (selectedUserId && user) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-8 text-white">
          <div className="flex items-center gap-4 mb-2">
            <button 
              onClick={() => {
                setSelectedUserId('');
                setUser(null);
                setIsEditMode(false);
                setSaveMessage(null);
              }} 
              className="hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">User Profile</h1>
              <p className="text-blue-100">{isEditMode ? 'Edit user information' : 'View user information from database'}</p>
            </div>
          </div>
        </div>

        {/* Profile Header with Avatar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600"></div>
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-16 relative z-10 mb-6">
              <img 
                src={user.avatar} 
                alt={user.name} 
                className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 object-cover shadow-lg"
              />
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
                <p className="text-gray-500 dark:text-gray-400">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {user.role === UserRole.SUPERUSER ? 'Superuser' : user.role === UserRole.ADMIN ? 'Admin' : 'Member'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`p-4 rounded-lg border flex items-center gap-3 ${
            saveMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
          }`}>
            {saveMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{saveMessage.text}</span>
          </div>
        )}

        {/* Basic Information */}
        {!isEditMode ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Full Name</label>
                <p className="text-lg text-gray-900 dark:text-white">{user.name}</p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Email Address</label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <p className="text-lg text-gray-900 dark:text-white">{user.email}</p>
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Phone Number</label>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <p className="text-lg text-gray-900 dark:text-white">{user.phoneNumber || 'Not provided'}</p>
                </div>
              </div>

              {/* User Role */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">User Role</label>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  user.role === UserRole.SUPERUSER ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                  user.role === UserRole.ADMIN ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                }`}>
                  {user.role === UserRole.SUPERUSER ? 'Superuser' : user.role === UserRole.ADMIN ? 'Admin' : 'Member'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6">Edit Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Full Name</label>
                <input
                  type="text"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Email Address</label>
                <input
                  type="email"
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={editFormData.phoneNumber || ''}
                  onChange={(e) => setEditFormData({...editFormData, phoneNumber: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* User Role */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">User Role</label>
                <select
                  value={editFormData.role || UserRole.USER}
                  onChange={(e) => setEditFormData({...editFormData, role: e.target.value as UserRole})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value={UserRole.USER}>Member</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.SUPERUSER}>Superuser</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Additional Information */}
        {!isEditMode ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6">Additional Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Occupation */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Occupation</label>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <p className="text-lg text-gray-900 dark:text-white">{user.occupation || 'Not specified'}</p>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Location</label>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <p className="text-lg text-gray-900 dark:text-white">{user.location || 'Not specified'}</p>
                </div>
              </div>

              {/* Join Date */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Join Date</label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-lg text-gray-900 dark:text-white">{user.joinDate || 'Unknown'}</p>
                </div>
              </div>

              {/* Reliability Score */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Reliability Score</label>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <p className="text-lg text-gray-900 dark:text-white">{user.reliabilityScore}%</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6">Edit Additional Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Occupation */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Occupation</label>
                <input
                  type="text"
                  value={editFormData.occupation || ''}
                  onChange={(e) => setEditFormData({...editFormData, occupation: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Location</label>
                <input
                  type="text"
                  value={editFormData.location || ''}
                  onChange={(e) => setEditFormData({...editFormData, location: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Status</label>
                <select
                  value={editFormData.status || 'ACTIVE'}
                  onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              {/* Reliability Score */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Reliability Score (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editFormData.reliabilityScore || 0}
                  onChange={(e) => setEditFormData({...editFormData, reliabilityScore: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Account Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6">Account Status</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Status</label>
              <span className={`inline-block px-4 py-2 rounded-lg text-sm font-medium ${
                user.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                user.status === 'SUSPENDED' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
              }`}>
                {user.status}
              </span>
            </div>

            {/* Verification Status */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Verification Status</label>
              <span className={`inline-block px-4 py-2 rounded-lg text-sm font-medium ${
                user.verificationStatus === 'VERIFIED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                user.verificationStatus === 'REJECTED' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              }`}>
                {user.verificationStatus}
              </span>
            </div>

            {/* KYC ID */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">KYC ID</label>
              <p className="text-lg text-gray-900 dark:text-white font-mono">{user.kycId || 'Not provided'}</p>
            </div>

            {/* User ID */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">User ID</label>
              <p className="text-lg text-gray-900 dark:text-white font-mono">{user.id}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-6">
          <button
            onClick={() => {
              setSelectedUserId('');
              setUser(null);
              setIsEditMode(false);
              setSaveMessage(null);
            }}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Back to List
          </button>
          
          {isEditMode ? (
            <>
              <button
                onClick={() => {
                  setIsEditMode(false);
                  setEditFormData(user);
                  setSaveMessage(null);
                }}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsEditMode(true);
                  setEditFormData(user);
                }}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </button>
              <button
                onClick={onCancel}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Show user list if no user is selected
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center gap-3 mb-2">
          {onCancel && (
            <button onClick={onCancel} className="hover:bg-white/20 p-2 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold">View User Profiles</h1>
            <p className="text-blue-100">Select a user to view their complete information</p>
          </div>
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white shadow-sm"
        />
      </div>

      {/* Users List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
          <UserIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No users found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left"
            >
              <div className="flex items-start gap-3">
                <img 
                  src={u.avatar} 
                  alt={u.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-white truncate">{u.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      u.role === UserRole.SUPERUSER ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                      u.role === UserRole.ADMIN ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    }`}>
                      {u.role === UserRole.SUPERUSER ? 'Superuser' : u.role === UserRole.ADMIN ? 'Admin' : 'Member'}
                    </span>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      u.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      {u.status}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Close Button */}
      {onCancel && (
        <div className="flex justify-end pt-6">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};
