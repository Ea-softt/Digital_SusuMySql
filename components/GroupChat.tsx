
import React, { useState, useEffect, useRef } from 'react';
import { User, GroupMessage } from '../types';
import { db } from '../services/database';
import { Send, Users, MoreVertical, Search, Smile, Paperclip } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

interface GroupChatProps {
  currentUser: User;
}

export const GroupChat: React.FC<GroupChatProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(db.getGroups()[0] || null);
  const [membershipStatus, setMembershipStatus] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load membership status when group changes
  useEffect(() => {
    const loadMembershipStatus = async () => {
      if (selectedGroup) {
        try {
          const res = await fetch(`${API_BASE}/group-membership/status/${currentUser.id}/${selectedGroup.id}`);
          const status = await res.json();
          setMembershipStatus(status);
        } catch (e) {
          console.warn("Failed to load membership status", e);
          setMembershipStatus({ status: 'UNKNOWN', is_blocked: false, is_deleted: false });
        }
      }
    };
    loadMembershipStatus();
  }, [selectedGroup, currentUser.id]);

  // Load messages initially and set up polling for "real-time" updates
  useEffect(() => {
    const loadMessages = async () => {
      const msgs = await db.getGroupMessages();
      // Only update if length changed to prevent constant re-renders during polling in this simple mock
      setMessages(prev => {
        if (prev.length !== msgs.length) return msgs;
        return prev;
      });
    };

    loadMessages();
    const interval = setInterval(loadMessages, 2000); // Poll every 2s

    return () => clearInterval(interval);
  }, [selectedGroup]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedGroup) return;

    await db.sendGroupMessage(currentUser, inputText, selectedGroup.id);
    setInputText('');
    
    // Immediate local update for better responsiveness
    const updatedMessages = await db.getGroupMessages(selectedGroup.id);
    setMessages(updatedMessages);
  };

  const handleJoinChat = async () => {
    if (selectedGroup) {
      try {
        const res = await fetch(`${API_BASE}/group-membership/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, groupId: selectedGroup.id })
        });
        if (res.ok) {
          await loadMembershipStatus();
          alert(`Joined "${selectedGroup.name}" successfully!`);
          setShowMenu(false);
        }
      } catch (e) {
        console.error("Failed to join chat", e);
        alert("Failed to join chat. Please try again.");
      }
    }
  };

  const handleBlockChat = async () => {
    if (selectedGroup) {
      try {
        const res = await fetch(`${API_BASE}/group-membership/block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, groupId: selectedGroup.id })
        });
        if (res.ok) {
          await loadMembershipStatus();
          alert(`Blocked "${selectedGroup.name}". You won't receive messages from this group.`);
          setShowMenu(false);
        }
      } catch (e) {
        console.error("Failed to block chat", e);
        alert("Failed to block chat. Please try again.");
      }
    }
  };

  const handleReactivateChat = async () => {
    if (selectedGroup) {
      try {
        const res = await fetch(`${API_BASE}/group-membership/reactivate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, groupId: selectedGroup.id })
        });
        if (res.ok) {
          await loadMembershipStatus();
          alert(`Reactivated "${selectedGroup.name}".`);
          setShowMenu(false);
        }
      } catch (e) {
        console.error("Failed to reactivate chat", e);
        alert("Failed to reactivate chat. Please try again.");
      }
    }
  };

  const handleDeleteChat = async () => {
    if (selectedGroup) {
      if (window.confirm(`Are you sure you want to delete "${selectedGroup.name}"? This action cannot be undone.`)) {
        try {
          const res = await fetch(`${API_BASE}/group-membership/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, groupId: selectedGroup.id })
          });
          if (res.ok) {
            const newGroup = db.getGroups().find(g => g.id !== selectedGroup.id);
            setSelectedGroup(newGroup || null);
            alert(`Deleted "${selectedGroup.name}".`);
            setShowMenu(false);
          }
        } catch (e) {
          console.error("Failed to delete chat", e);
          alert("Failed to delete chat. Please try again.");
        }
      }
    }
  };

  const loadMembershipStatus = async () => {
    if (selectedGroup) {
      try {
        const res = await fetch(`${API_BASE}/group-membership/status/${currentUser.id}/${selectedGroup.id}`);
        const status = await res.json();
        setMembershipStatus(status);
      } catch (e) {
        console.warn("Failed to load membership status", e);
      }
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString();
  };

  // Group messages by date
  const groupedMessages: { [key: string]: GroupMessage[] } = {};
  messages.forEach(msg => {
    const dateKey = formatDate(msg.timestamp);
    if (!groupedMessages[dateKey]) {
      groupedMessages[dateKey] = [];
    }
    groupedMessages[dateKey].push(msg);
  });

  // Filter groups by search query
  const allGroups = db.getGroups();
  const filteredGroups = searchQuery.trim()
    ? allGroups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allGroups;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">{selectedGroup?.name || 'Select a Group'}</h3>
            <p className="text-xs text-green-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              {selectedGroup?.membersCount || 0} Members
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 relative">
          <button 
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMenu && selectedGroup && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <button
                  onClick={handleJoinChat}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm border-b border-gray-100 dark:border-gray-700 transition-colors"
                >
                  ✓ Join Chat
                </button>
                <button
                  onClick={handleBlockChat}
                  disabled={membershipStatus?.is_blocked}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white text-sm border-b border-gray-100 dark:border-gray-700 transition-colors"
                >
                  🚫 Block Chat
                </button>
                <button
                  onClick={handleReactivateChat}
                  disabled={!membershipStatus?.is_deleted && !membershipStatus?.is_blocked}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white text-sm border-b border-gray-100 dark:border-gray-700 transition-colors"
                >
                  ↻ Reactivate Chat
                </button>
                <button
                  onClick={handleDeleteChat}
                  className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm transition-colors"
                >
                  🗑️ Delete Chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Group Search Bar */}
      {showSearch && (
        <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 max-h-64 overflow-y-auto">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            />
          </div>
          <div className="space-y-2">
            {filteredGroups.length > 0 ? (
              filteredGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedGroup(group);
                    setShowSearch(false);
                    setSearchQuery('');
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedGroup?.id === group.id
                      ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{group.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{group.membersCount} members • {group.currency}</p>
                    </div>
                    {selectedGroup?.id === group.id && (
                      <span className="text-primary-600 dark:text-primary-400 font-bold">✓</span>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No groups found</p>
            )}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50 dark:bg-gray-900/50"
      >
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="flex justify-center mb-4">
              <span className="text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full uppercase tracking-wider">
                {date}
              </span>
            </div>
            <div className="space-y-4">
              {msgs.map((msg) => {
                const isMe = msg.senderId === currentUser.id;
                const isSystem = msg.type === 'system';

                if (isSystem) {
                    return (
                        <div key={msg.id} className="flex justify-center my-2">
                             <p className="text-xs text-gray-400 italic bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg">
                                 {msg.text}
                             </p>
                        </div>
                    );
                }

                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} group`}>
                    {!isMe && (
                      <img 
                        src={msg.senderAvatar} 
                        alt={msg.senderName} 
                        className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-600 self-end mb-1"
                      />
                    )}
                    
                    <div className={`max-w-[70%] md:max-w-[60%]`}>
                        {!isMe && <p className="text-xs text-gray-500 dark:text-gray-400 ml-1 mb-1">{msg.senderName}</p>}
                        <div 
                            className={`
                                p-3 rounded-2xl text-sm shadow-sm relative
                                ${isMe 
                                    ? 'bg-primary-600 text-white rounded-br-none' 
                                    : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                                }
                            `}
                        >
                            {msg.text}
                            <span className={`text-[10px] absolute bottom-1 right-2 ${isMe ? 'text-primary-200' : 'text-gray-400'}`}>
                                {formatTime(msg.timestamp)}
                            </span>
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
        <form 
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 transition-all"
        >
          <button type="button" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
          
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none max-h-32 py-2 text-sm"
            rows={1}
            style={{ minHeight: '40px' }}
          />
          
          <button type="button" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
             <Smile className="w-5 h-5" />
          </button>

          <button 
            type="submit" 
            disabled={!inputText.trim()}
            className="p-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
