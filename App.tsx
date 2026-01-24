
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from './components/Layout';
import { MemberDashboard } from './components/MemberDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { SuperuserDashboard } from './components/SuperuserDashboard';
import { GeminiAdvisor } from './components/GeminiAdvisor';
import { ProfileSettings } from './components/ProfileSettings';
import { GroupChat } from './components/GroupChat';
import { TransactionHistory } from './components/TransactionHistory';
import { JoinGroup } from './components/JoinGroup';
import { HelpCenter } from './components/HelpCenter';
import { CreateUserProfile } from './components/CreateUserProfile';
import { AIHelpCenter } from './components/AIHelpCenter';
import { User, UserRole, Group, Transaction } from './types';
import { db } from './services/database';
import { Lock, Mail, User as UserIcon, Wallet, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ArrowLeft, ShieldCheck, MapPin, Briefcase, FileText, Upload, Users, Crown, Camera, X, Phone, Smartphone, Star, Quote, Award, Copy, TrendingUp, Sparkles, MessageCircle, Database, Server, RefreshCw } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot' | '2fa';

const SESSION_KEY = 'susu_auth_session_email';
const LAST_GROUP_KEY = 'susu_last_active_group_id';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [contextUser, setContextUser] = useState<User | null>(null);

  const [dbMembers, setDbMembers] = useState<User[]>([]);
  const [dbTransactions, setDbTransactions] = useState<Transaction[]>([]);
  const [dbGroups, setDbGroups] = useState<Group[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [location, setLocation] = useState('');
  const [kycId, setKycId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [registerRole, setRegisterRole] = useState<UserRole>(UserRole.MEMBER);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const refreshData = useCallback(async () => {
    const success = currentUser ? await db.syncData(currentUser.id) : await db.syncData();
    setServerOnline(db.getServerStatus());

    setDbMembers(db.getMembers());
    setDbTransactions(db.getTransactions());
    setDbGroups(db.getGroups());
    
    if (currentUser) {
        const updatedUser = db.getMembers().find(u => u.id === currentUser.id) || currentUser;
        setCurrentUser(updatedUser);
        const groups = db.getGroupsForUser(currentUser.id);
        setUserGroups(groups);

        if (activeGroup) {
            const updatedGroup = groups.find(g => g.id === activeGroup.id) || (groups.length > 0 ? groups[0] : null);
            setActiveGroup(updatedGroup);
        } else if (groups.length > 0) {
            setActiveGroup(groups[0]);
        }
    }
  }, [currentUser, activeGroup]);

  // Handle session restoration on mount
  useEffect(() => {
    const restoreSession = async () => {
      const savedEmail = localStorage.getItem(SESSION_KEY);
      if (savedEmail) {
        try {
          const user = await db.authenticate(savedEmail);
          if (user) {
            handleLogin(user, true); // true indicates we are restoring
          }
        } catch (err) {
          console.error("Failed to restore session", err);
        }
      }
      setIsRestoringSession(false);
      refreshData();
    };

    restoreSession();

    const interval = setInterval(() => {
        if (!currentUser) refreshData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      if (currentUser && activeGroup) {
          const scoped = db.getScopedUser(currentUser.id, activeGroup.id);
          setContextUser(scoped);
      } else if (currentUser) {
          setContextUser(currentUser); 
      }
  }, [currentUser, activeGroup]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const handleTakePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setProfileImage(dataUrl);
        setIsCameraOpen(false);
      }
    }
  };

  const handleGetLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;
            setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            setIsLocating(false);
        }, () => {
            setIsLocating(false);
            setNotification({ type: 'error', message: 'Location access denied.' });
        });
    } else {
         setIsLocating(false);
    }
  };

  const handleLogin = (user: User, isRestoring = false) => {
    setCurrentUser(user);
    if (!isRestoring) {
        localStorage.setItem(SESSION_KEY, user.email);
    }
    
    const groups = db.getGroupsForUser(user.id);
    setUserGroups(groups);
    if (groups.length > 0) {
        const lastGroupId = localStorage.getItem(LAST_GROUP_KEY);
        const lastGroup = lastGroupId ? groups.find(g => g.id === lastGroupId) : null;
        setActiveGroup(lastGroup || groups[0]); // Restore or fallback
        setCurrentView('dashboard');
    } else {
        setActiveGroup(null);
        setCurrentView('join-group');
    }
    if (user.role === UserRole.SUPERUSER) setCurrentView('admin-mgmt');
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_GROUP_KEY);
    setCurrentUser(null);
    setContextUser(null);
    setActiveGroup(null);
    setUserGroups([]);
    setAuthMode('login');
    setNotification(null);
  };

  const handleGroupSwitch = (group: Group | null) => {
      if (group) {
          setActiveGroup(group);
          setCurrentView('dashboard');
          localStorage.setItem(LAST_GROUP_KEY, group.id);
      } else {
          setActiveGroup(null);
          setCurrentView('join-group');
          localStorage.removeItem(LAST_GROUP_KEY);
      }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setNotification(null);

    if (authMode === 'login') {
      try {
          const existingUser = await db.authenticate(email);
          if (existingUser) {
              handleLogin(existingUser);
          } else {
              const status = db.getServerStatus();
              if (status === false) {
                  setNotification({ type: 'error', message: 'Backend server is offline. Check Node.js console.' });
              } else {
                  setNotification({ type: 'error', message: 'Account not found. For first use, log in with admin@system.com' });
              }
          }
      } catch (err) {
          setNotification({ type: 'error', message: 'Connection refused. Ensure backend is running on port 3001.' });
      }
      setIsLoading(false);
      return;
    }

    if (authMode === 'register') {
      // NEW USERS: All start as PENDING / PENDING VERIFICATION
      const newUser: User = {
          id: `u${Date.now()}`,
          name: name,
          email: email,
          phoneNumber: phoneNumber,
          role: registerRole,
          avatar: profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
          occupation: occupation,
          location: location,
          kycId: kycId,
          status: 'PENDING',
          verificationStatus: 'PENDING',
          joinDate: new Date().toISOString().split('T')[0],
          reliabilityScore: 100,
          memberships: []
      };

      try {
          await db.registerUser(newUser);
          handleLogin(newUser);
          setNotification({ type: 'info', message: 'Registration successful! Your account is pending verification by the system administrator.' });
      } catch (err) {
          setNotification({ type: 'error', message: 'Registration failed. Backend connection issue.' });
      }
      setIsLoading(false);
      return;
    }
  };

  // While checking for session, show a clean loading screen
  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-primary-900 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
        <p className="text-primary-100 font-medium animate-pulse">Resuming your session...</p>
      </div>
    );
  }

  if (currentUser) {
    if (currentUser.role === UserRole.SUPERUSER) {
        // Handle special views for superuser
        if (currentView === 'create-profile') {
            return (
                <Layout currentUser={currentUser} onLogout={handleLogout} currentView={currentView} onNavigate={setCurrentView} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}>
                    <CreateUserProfile onSuccess={refreshData} onCancel={() => setCurrentView('dashboard')} />
                </Layout>
            );
        }
        
        if (currentView === 'ai-help') {
            return (
                <Layout currentUser={currentUser} onLogout={handleLogout} currentView={currentView} onNavigate={setCurrentView} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}>
                    <AIHelpCenter />
                </Layout>
            );
        }

        // Map navigation views to SuperuserDashboard tabs
        const tabMap: { [key: string]: 'overview' | 'users' | 'groups' | 'financials' | 'verification' | 'security' | 'chat' | 'settings' } = {
            'dashboard': 'overview',
            'chat': 'chat',
            'transactions': 'financials',
            'admin-mgmt': 'overview',
        };
        const initialTab = tabMap[currentView] || 'overview';

        return (
            <Layout currentUser={currentUser} onLogout={handleLogout} currentView={currentView} onNavigate={setCurrentView} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}>
                <SuperuserDashboard members={dbMembers} transactions={dbTransactions} groups={dbGroups} onRefresh={refreshData} currentUser={currentUser} initialTab={initialTab} />
            </Layout>
        );
    }

    return (
      <Layout currentUser={contextUser || currentUser} onLogout={handleLogout} currentView={currentView} onNavigate={setCurrentView} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)} activeGroup={activeGroup} userGroups={userGroups} onSwitchGroup={handleGroupSwitch}>
        {/* Navigation Views */}
        {currentView === 'dashboard' && activeGroup && contextUser && (
            <>
                {contextUser.role === UserRole.MEMBER && <MemberDashboard group={activeGroup} transactions={dbTransactions} userId={currentUser.id} currentUser={contextUser} onRefresh={refreshData} members={dbMembers} />}
                {contextUser.role === UserRole.ADMIN && <AdminDashboard group={activeGroup} transactions={dbTransactions} members={dbMembers} currentUser={contextUser} onRefresh={refreshData} initialTab="overview" />}
            </>
        )}
        {currentView === 'join-group' && <JoinGroup userId={currentUser.id} onSuccess={refreshData} onCancel={userGroups.length > 0 ? () => handleGroupSwitch(userGroups[0]) : undefined} />}
        {currentView === 'help' && <HelpCenter />}
        {currentView === 'ai-help' && <AIHelpCenter />}
        {currentView === 'chat' && activeGroup && <GroupChat currentUser={contextUser || currentUser} />}
        {currentView === 'profile' && <ProfileSettings user={currentUser} onUpdateProfile={(data) => db.updateUser(currentUser.id, data).then(refreshData)} />}
        {currentView === 'create-profile' && <CreateUserProfile onSuccess={refreshData} onCancel={() => setCurrentView('dashboard')} />}
        {currentView === 'transactions' && activeGroup && <TransactionHistory transactions={dbTransactions} currency={activeGroup.currency} />}
        {currentView === 'members' && activeGroup && contextUser?.role === UserRole.ADMIN && <AdminDashboard group={activeGroup} transactions={dbTransactions} members={dbMembers} currentUser={contextUser} onRefresh={refreshData} initialTab="members" />}
        {currentView === 'settings' && activeGroup && contextUser?.role === UserRole.ADMIN && <AdminDashboard group={activeGroup} transactions={dbTransactions} members={dbMembers} currentUser={contextUser} onRefresh={refreshData} initialTab="settings" />}
        {currentView === 'admin-mgmt' && contextUser?.role === UserRole.SUPERUSER && <SuperuserDashboard members={dbMembers} transactions={dbTransactions} groups={dbGroups} onRefresh={refreshData} currentUser={currentUser} />}
        <GeminiAdvisor />
      </Layout>
    );
  }

  return (
    <div className="min-h-screen bg-primary-900 font-sans relative overflow-hidden flex items-center justify-center p-4">
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-black rounded-3xl overflow-hidden shadow-2xl border border-gray-800">
             <video ref={videoRef} autoPlay playsInline muted className="w-full h-[400px] object-cover transform scale-x-[-1]" />
             <canvas ref={canvasRef} className="hidden" />
             <button onClick={() => setIsCameraOpen(false)} className="absolute top-4 right-4 bg-gray-800/80 text-white p-3 rounded-full hover:bg-gray-700 transition-colors backdrop-blur-sm">
                <X className="w-6 h-6" />
             </button>
             <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/80 to-transparent flex justify-center">
                <button onClick={handleTakePhoto} className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 hover:border-primary-500 hover:scale-105 transition-all flex items-center justify-center shadow-lg">
                    <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-gray-300"></div>
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Backend Status Badge */}
      <div className="fixed top-6 left-6 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-bold transition-all bg-white/10 text-white border-white/20">
         {serverOnline === null ? (
             <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> <span>Connecting...</span></>
         ) : serverOnline ? (
             <><Database className="w-3.5 h-3.5 text-green-400" /> <span className="text-green-400">MySQL Online</span></>
         ) : (
             <><Server className="w-3.5 h-3.5 text-red-400 animate-pulse" /> <span className="text-red-400">Backend Offline</span></>
         )}
      </div>

      <div className="absolute inset-0 w-full h-full bg-primary-900 overflow-hidden z-0">
        <div className="hidden lg:flex flex-col justify-between h-full p-16 relative z-10 pointer-events-none">
            <div className="animate-fade-in-down">
                <div className="flex items-center gap-3 mb-10"><div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg"><Wallet className="w-8 h-8 text-white" /></div><h1 className="text-3xl font-bold tracking-tight text-white">Digital Susu</h1></div>
                <h2 className="text-5xl font-extrabold leading-tight mb-6 text-white">Real-Time<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-200 to-white">MySQL Ledger.</span></h2>
                <p className="text-primary-100 text-lg max-w-md leading-relaxed">Connected directly to your local database for persistent savings management.</p>
            </div>
        </div>
      </div>

      <div className="relative z-20 w-full max-w-[440px] animate-fade-in-up">
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700">
                <div className="mb-8 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Access your secure susu portal.</p>
                </div>

                {notification && (
                    <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm border ${notification.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : notification.type === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : notification.type === 'info' ? <AlertCircle className="w-5 h-5 text-blue-500" /> : <AlertCircle className="w-5 h-5" />}
                        <span>{notification.message}</span>
                    </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-5">
                    {authMode === 'register' && (
                         <>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <button type="button" onClick={() => setRegisterRole(UserRole.MEMBER)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${registerRole === UserRole.MEMBER ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}><Users className="w-6 h-6" /><span className="text-sm font-bold">Member</span></button>
                                <button type="button" onClick={() => setRegisterRole(UserRole.ADMIN)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${registerRole === UserRole.ADMIN ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}><Crown className="w-6 h-6" /><span className="text-sm font-bold">Leader</span></button>
                            </div>
                            <div className="flex flex-col items-center mb-6">
                                <div className="relative cursor-pointer" onClick={() => setIsCameraOpen(true)}>
                                    <div className={`w-24 h-24 rounded-full flex items-center justify-center overflow-hidden border-4 ${profileImage ? 'border-primary-500' : 'border-gray-300 bg-gray-50'}`}>{profileImage ? <img src={profileImage} alt="" className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-400" />}</div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Full Name" />
                                <input type="text" required value={occupation} onChange={e => setOccupation(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Occupation" />
                                <input type="tel" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Phone Number" />
                                <div className="flex gap-2">
                                    <input type="text" readOnly required value={location} className="flex-1 p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Location" />
                                    <button type="button" onClick={handleGetLocation} className="p-3 bg-primary-100 rounded-xl"><MapPin className="w-5 h-5 text-primary-600" /></button>
                                </div>
                                <input type="text" required value={kycId} onChange={e => setKycId(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="National ID" />
                            </div>
                         </>
                    )}

                    <div className="space-y-4">
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Email Address" />
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Password" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-gray-400">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                        </div>
                    </div>

                    <button type="submit" disabled={isLoading} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (authMode === 'login' ? 'Sign In' : 'Register')}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                        <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="font-bold text-primary-600">
                            {authMode === 'login' ? 'Sign Up' : 'Log In'}
                        </button>
                    </p>
                </div>
            </div>
      </div>
    </div>
  );
};

export default App;
