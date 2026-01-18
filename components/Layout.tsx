
/*
 * LAYOUT.TSX - THE SIDEBAR & HEADER
 * ---------------------------------
 * This file controls the frame of your application.
 * 
 * HOW TO EDIT THE MENU:
 * 1. Scroll down to the `navItems` array.
 * 2. To add a page, add a new object: { id: 'my-page', label: 'My Page', icon: IconName }
 * 3. Don't forget to import the IconName from 'lucide-react' at the top.
 */

import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Notification, Group } from '../types';
import { LogOut, LayoutDashboard, Users, Wallet, Settings, Menu, ShieldCheck, UserCog, Moon, Sun, Bell, X, Check, Trash2, Info, AlertTriangle, CheckCircle, AlertCircle, MessageSquare, ChevronDown, PlusCircle, HelpCircle } from 'lucide-react';
import { MOCK_NOTIFICATIONS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  onLogout: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  activeGroup?: Group | null;
  userGroups?: Group[];
  onSwitchGroup?: (group: Group | null) => void; // null triggers join new group view
}

export const Layout: React.FC<LayoutProps> = ({ children, currentUser, onLogout, currentView, onNavigate, isDarkMode, toggleDarkMode, activeGroup, userGroups = [], onSwitchGroup }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  
  const notificationRef = useRef<HTMLDivElement>(null);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize notifications based on user role
  useEffect(() => {
    const userNotifs = MOCK_NOTIFICATIONS.filter(n => 
      n.recipientId === 'ALL' || 
      n.recipientId === currentUser.id ||
      (currentUser.role === UserRole.ADMIN && n.recipientId === 'ADMIN')
    ).sort((a, b) => b.timestamp - a.timestamp);
    setNotifications(userNotifs);
  }, [currentUser]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
        setIsGroupDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- MENU CONFIGURATION (TUTORIAL) ---
  // To add a new menu item:
  // 1. Pick an icon name (e.g., 'HelpCircle') and import it at the top of this file.
  // 2. Add a new line below: { id: 'help', label: 'Help', icon: HelpCircle }
  // 3. Go to App.tsx and handle the view rendering for 'help'.
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'chat', label: 'Group Chat', icon: MessageSquare },
    { id: 'transactions', label: 'Transactions', icon: Wallet },
    { id: 'profile', label: 'My Profile', icon: UserCog },
    { id: 'help', label: 'Help Center', icon: HelpCircle }, // Added Help Center
    
    // Admin-only items
    ...(currentUser.role === UserRole.ADMIN ? [
        { id: 'members', label: 'Members', icon: Users },
        { id: 'settings', label: 'Group Settings', icon: Settings }
    ] : []),
    
    // Superuser-only items
    ...(currentUser.role === UserRole.SUPERUSER ? [
        { id: 'admin-mgmt', label: 'Admin Management', icon: ShieldCheck }
    ] : [])
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNotificationClick = (n: Notification) => {
    // ... logic same as before ...
    setIsNotificationsOpen(false);
    onNavigate('dashboard');
  };

  const formatTime = (timestamp: number) => {
    // ... same logic ...
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getIcon = (type: Notification['type']) => {
    switch(type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col md:flex-row transition-colors duration-200">
      {/* Mobile Header */}
      <div className="md:hidden bg-primary-700 dark:bg-primary-900 text-white p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold flex items-center gap-2 truncate max-w-[200px]">
          <Wallet className="w-6 h-6 shrink-0" /> {activeGroup ? activeGroup.name : 'Digital Susu'}
        </h1>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="relative">
             <Bell className="w-6 h-6" />
             {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold border border-primary-700">
                  {unreadCount}
                </span>
             )}
          </button>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-primary-800 dark:bg-gray-900 dark:border-r dark:border-gray-800 text-white transform transition-transform duration-200 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col
      `}>
        {/* Header with Group Switcher */}
        <div className="p-6 border-b border-primary-700 dark:border-gray-800 hidden md:block">
           {currentUser.role !== UserRole.SUPERUSER && onSwitchGroup ? (
               <div className="relative" ref={groupDropdownRef}>
                   <button 
                        onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                        className="w-full flex items-center justify-between text-left focus:outline-none group"
                   >
                        <div>
                            <div className="flex items-center gap-2">
                                <Wallet className="w-6 h-6 text-primary-300" />
                                <h1 className="text-lg font-bold truncate max-w-[140px]">{activeGroup ? activeGroup.name : 'Select Group'}</h1>
                            </div>
                            <p className="text-xs text-primary-300 mt-1 uppercase tracking-wider pl-8">{currentUser.role === UserRole.ADMIN ? 'Leader Portal' : 'Member Portal'}</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-primary-300 group-hover:text-white transition-colors" />
                   </button>

                   {/* Dropdown Menu */}
                   {isGroupDropdownOpen && (
                       <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 text-gray-900 dark:text-white animate-fade-in-up">
                           <div className="py-2">
                               <p className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Your Groups</p>
                               {userGroups.map(group => (
                                   <button 
                                        key={group.id}
                                        onClick={() => {
                                            if (onSwitchGroup) onSwitchGroup(group);
                                            setIsGroupDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${activeGroup?.id === group.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-bold' : ''}`}
                                   >
                                       <span className="truncate">{group.name}</span>
                                       {activeGroup?.id === group.id && <Check className="w-3 h-3" />}
                                   </button>
                               ))}
                               <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                               <button 
                                    onClick={() => {
                                        if (onSwitchGroup) onSwitchGroup(null);
                                        setIsGroupDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-primary-600 dark:text-primary-400 font-bold flex items-center gap-2"
                               >
                                   <PlusCircle className="w-4 h-4" /> Join New Group
                               </button>
                           </div>
                       </div>
                   )}
               </div>
           ) : (
                <>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Wallet className="w-8 h-8 text-primary-300" /> Digital Susu
                    </h1>
                    <p className="text-xs text-primary-300 mt-1 uppercase tracking-wider">Superuser Portal</p>
                </>
           )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === item.id 
                  ? 'bg-primary-600 dark:bg-gray-800 text-white shadow-sm' 
                  : 'text-primary-100 hover:bg-primary-700 dark:hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
          
          {/* Mobile Group Switcher */}
          <div className="md:hidden pt-4 mt-4 border-t border-primary-700 dark:border-gray-800">
              <p className="px-4 text-xs font-bold text-primary-300 uppercase mb-2">Switch Group</p>
              {userGroups.map(group => (
                   <button
                        key={group.id}
                        onClick={() => {
                            if (onSwitchGroup) onSwitchGroup(group);
                            setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm rounded-lg ${activeGroup?.id === group.id ? 'bg-primary-900/50 text-white font-bold' : 'text-primary-100'}`}
                   >
                       <span className="truncate">{group.name}</span>
                       {activeGroup?.id === group.id && <Check className="w-4 h-4" />}
                   </button>
              ))}
              <button 
                    onClick={() => {
                        if (onSwitchGroup) onSwitchGroup(null);
                        setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white font-bold hover:bg-primary-700 rounded-lg mt-2"
                >
                    <PlusCircle className="w-4 h-4" /> Join New Group
                </button>
          </div>
        </nav>

        <div className="p-4 border-t border-primary-700 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <img src={currentUser.avatar} alt="User" className="w-10 h-10 rounded-full border-2 border-primary-500" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-xs text-primary-300 truncate">{currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 bg-primary-900/50 dark:bg-gray-800 hover:bg-primary-900 dark:hover:bg-gray-700 text-primary-100 py-2 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <header className="bg-white dark:bg-gray-800 shadow-sm dark:shadow-none dark:border-b dark:border-gray-700 p-6 flex justify-between items-center transition-colors duration-200 relative z-30">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white capitalize">{currentView.replace('-', ' ')}</h2>
            <div className="flex items-center gap-3 md:gap-4">
                {/* Notification Bell & Dropdown Code (unchanged) */}
                <div className="relative" ref={notificationRef}>
                  <button 
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                    title="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800 animate-pulse"></span>
                    )}
                  </button>
                  {isNotificationsOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-fade-in-up">
                      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                          <h3 className="font-bold text-gray-800 dark:text-white">Notifications</h3>
                          <div className="flex gap-3">
                            {unreadCount > 0 && (
                              <button onClick={markAllAsRead} className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline flex items-center gap-1">
                                <Check className="w-3 h-3" /> Mark all read
                              </button>
                            )}
                          </div>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                          {notifications.length === 0 ? (
                              <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm flex flex-col items-center">
                                  <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                                  No notifications yet.
                              </div>
                          ) : (
                              notifications.map(n => (
                                  <div 
                                    key={n.id} 
                                    className={`p-4 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group cursor-pointer ${!n.read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                                    onClick={() => handleNotificationClick(n)}
                                  >
                                      <div className="flex gap-3">
                                          <div className={`mt-1 shrink-0 ${!n.read ? 'opacity-100' : 'opacity-50'}`}>
                                            {getIcon(n.type)}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <div className="flex justify-between items-start mb-0.5">
                                                  <h4 className={`text-sm font-medium truncate pr-2 ${!n.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{n.title}</h4>
                                                  <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">{formatTime(n.timestamp)}</span>
                                              </div>
                                              <p className={`text-xs leading-relaxed line-clamp-2 ${!n.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-500'}`}>{n.message}</p>
                                          </div>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }} 
                                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                            title="Delete"
                                          >
                                              <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                    onClick={toggleDarkMode}
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                
                <div className="hidden md:block text-sm text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700 pl-4">
                    {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
            </div>
        </header>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
