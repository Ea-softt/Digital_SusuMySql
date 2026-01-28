
import React, { useState } from 'react';
import { Search, ShieldAlert, ArrowRight, UserPlus, PlusCircle } from 'lucide-react';
import { db } from '../services/database';
import { User } from '../types';

interface JoinGroupProps {
  userId: string;
  onSuccess: () => void;
  onCancel?: () => void;
  canCreateGroup: boolean;
}

export const JoinGroup: React.FC<JoinGroupProps> = ({ userId, onSuccess, onCancel, canCreateGroup }) => {
  const [view, setView] = useState<'join' | 'create'>('join');

  // Join state
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Create state
  const [groupName, setGroupName] = useState('');
  const [contributionAmount, setContributionAmount] = useState('100');
  const [currency, setCurrency] = useState('GHS');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleJoinGroup = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setIsJoining(true);

    setTimeout(async () => {
        const result = await db.joinGroupRequest(userId, joinCode);
        if (result.success) {
            alert("Join request sent successfully!");
            onSuccess();
        } else {
            setJoinError(result.message);
        }
        setIsJoining(false);
    }, 1000);
  };
  
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!groupName || !contributionAmount) {
        setCreateError("Please fill in all fields.");
        return;
    }
    setIsCreating(true);

    try {
        const newGroup = await db.createGroup({
            name: groupName,
            contributionAmount: parseFloat(contributionAmount),
            creatorId: userId,
            currency,
        });
        if (newGroup) {
            alert(`Group '${newGroup.name}' created successfully!`);
            onSuccess();
        } else {
            throw new Error("Group creation returned no data.");
        }
    } catch (err: any) {
        setCreateError(err.message || "An unknown error occurred.");
    } finally {
        setIsCreating(false);
    }
  };

  const renderJoinView = () => (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-primary-600 p-8 text-center relative">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <UserPlus className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Join a New Group</h2>
              <p className="text-primary-100 text-sm mt-2">Enter the unique code to join another savings circle.</p>
              
              {onCancel && (
                  <button 
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-white/70 hover:text-white text-sm font-medium"
                  >
                      Cancel
                  </button>
              )}
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
               <div className="text-center mt-6">
                  <span className="text-sm text-gray-500">Or</span>
              </div>
              {canCreateGroup ? (
                <button 
                    onClick={() => setView('create')}
                    className="w-full mt-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                    <PlusCircle className="w-5 h-5" /> Create a New Group
                </button>
              ) : (
                <div className="mt-4 text-center text-sm text-gray-500 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    Only administrators can create new groups.
                </div>
              )}
          </div>
      </div>
  );

  const renderCreateView = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-green-600 p-8 text-center relative">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <PlusCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Create a New Group</h2>
            <p className="text-green-100 text-sm mt-2">Set up a new savings circle and invite your members.</p>
        </div>
        <div className="p-8">
            <form onSubmit={handleCreateGroup} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Group Name</label>
                    <input 
                        type="text" 
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="e.g. Family & Friends"
                        className="w-full p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500"
                        required
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contribution</label>
                        <input 
                            type="number" 
                            value={contributionAmount}
                            onChange={(e) => setContributionAmount(e.target.value)}
                            placeholder="100"
                            className="w-full p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Currency</label>
                        <select 
                            value={currency} 
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="GHS">GHS (₵)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                        </select>
                    </div>
                </div>
                
                {createError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2 justify-center">
                        <ShieldAlert className="w-4 h-4" /> {createError}
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={isCreating}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
                >
                    {isCreating ? 'Creating Group...' : 'Create and Join Group'}
                    {!isCreating && <ArrowRight className="w-5 h-5" />}
                </button>
            </form>
            <div className="text-center mt-6">
                <span className="text-sm text-gray-500">Or</span>
            </div>
            <button 
                onClick={() => setView('join')}
                className="w-full mt-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
                <Search className="w-5 h-5" /> Join an Existing Group
            </button>
        </div>
    </div>
  );

  return (
      <div className="max-w-md mx-auto mt-10 animate-fade-in">
          {view === 'join' ? renderJoinView() : renderCreateView()}
      </div>
  );
};
