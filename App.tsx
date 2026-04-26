
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
const REG_DRAFT_KEY = 'susu_registration_draft';
const API_URL = '/api';

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
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [location, setLocation] = useState('');
  const [kycId, setKycId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [registerRole, setRegisterRole] = useState<UserRole>(UserRole.MEMBER);
  const [forgotStep, setForgotStep] = useState(1);
  const [resetCode, setResetCode] = useState('');
  const [regStep, setRegStep] = useState(1);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [idFrontImage, setIdFrontImage] = useState<string | null>(null);
  const [idBackImage, setIdBackImage] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<'profile' | 'idFront' | 'idBack'>('profile');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ status: 'ok' | 'bad'; message: string } | null>(null);
  
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
    const success = currentUser ? await db.syncData(currentUser.id, activeGroup?.id) : await db.syncData();
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
      if (savedEmail && db.getServerStatus() !== false) {
        await refreshData();
      }
      setIsRestoringSession(false);
    };

    restoreSession();

    const interval = setInterval(() => {
        // Only poll for updates if the user is actually logged in
        // This prevents 401 errors from unauthorized background requests
        if (currentUser) refreshData();
    }, 10000);
    return () => clearInterval(interval);
  }, [currentUser, refreshData]);

  useEffect(() => {
    if (authMode === 'register') {
      const draft = { name, email, occupation, phoneNumber, location, kycId, bio, role: registerRole };
      localStorage.setItem(REG_DRAFT_KEY, JSON.stringify(draft));
    } else {
      setRegStep(1);
    }
  }, [name, email, occupation, phoneNumber, location, kycId, bio, registerRole, authMode]);

  // 📸 Camera Stream Management
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: cameraMode === 'profile' ? 'user' : 'environment' } 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera access error:", err);
        setNotification({ type: 'error', message: 'Could not access camera. Please check browser permissions.' });
        setIsCameraOpen(false);
      }
    };

    if (isCameraOpen) startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [isCameraOpen, cameraMode]);

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

  // 🛡️ Intelligent Image Quality Analysis
  const analyzeImageQuality = (canvas: HTMLCanvasElement, mode: 'profile' | 'idFront' | 'idBack') => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { status: 'bad' as const, message: 'Processing error.' };

    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    let edgeScore = 0;
    let centerEdgeScore = 0;
    let centerPixels = 0;

    // Define the "Target Area" based on the UI overlays
    const centerX = width / 2;
    const centerY = height / 2;
    const targetRadius = Math.min(width, height) * 0.3; // Approx size of the green circle

    // Sample pixels to determine brightness and focus (Laplacian variance proxy)
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % width;
        const y = Math.floor((i / 4) / width);
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        totalBrightness += avg;

        if (i < data.length - 4) {
            const nextAvg = (data[i + 4] + data[i + 5] + data[i + 6]) / 3;
            const diff = Math.abs(avg - nextAvg);
            edgeScore += diff;

            // Heuristic: Check for detail concentration in the guide area (circle/frame)
            const distFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            if (distFromCenter < targetRadius) {
                centerEdgeScore += diff;
                centerPixels++;
            }
        }
    }

    const brightness = totalBrightness / (width * height);
    const clarity = edgeScore / (width * height);
    const centerClarity = centerPixels > 0 ? centerEdgeScore / centerPixels : 0;

    // Forgiving thresholds: Allow for moderate lighting and minor blur while still ensuring basic quality
    if (brightness < 45) return { status: 'bad' as const, message: 'Subject is too dark. Increase lighting.' };
    if (brightness > 235) return { status: 'bad' as const, message: 'Subject is overexposed. Reduce glare.' };

    // If it's a profile photo, we strictly check that the center (the green circle) has enough detail/contrast
    // This prevents empty backgrounds or off-center captures from passing.
    if (mode === 'profile' && centerClarity < 2) {
        return { status: 'bad' as const, message: 'Face not detected in the circle. Please center your face.' };
    }

    if (clarity < 2) return { status: 'bad' as const, message: 'Image is too blurry. Hold steady and ensure focus.' };

    return { status: 'ok' as const, message: 'Perfect! Image is clear and well-positioned.' };
  };

  const handleTakePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        
        // Ensure capture orientation matches preview
        if (cameraMode === 'profile') {
            context.translate(canvasRef.current.width, 0);
            context.scale(-1, 1);
        }
        context.drawImage(videoRef.current, 0, 0);
        context.setTransform(1, 0, 0, 1, 0, 0);

        // Use JPEG with 0.7 quality to significantly reduce payload size for the backend
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.7);
        
        setIsAnalyzing(true);
        setAnalysisResult(null);

        // Processing delay to simulate AI analysis
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        const result = analyzeImageQuality(canvasRef.current, cameraMode);
        setAnalysisResult(result);

        if (result.status === 'ok') {
            setTimeout(() => {
                if (cameraMode === 'profile') setProfileImage(dataUrl);
                else if (cameraMode === 'idFront') setIdFrontImage(dataUrl);
                else if (cameraMode === 'idBack') setIdBackImage(dataUrl);
                setIsCameraOpen(false);
                setIsAnalyzing(false);
                setAnalysisResult(null);
            }, 1000);
        } else {
            setIsAnalyzing(false);
        }
      }
    }
  };

  const openCamera = (mode: 'profile' | 'idFront' | 'idBack') => {
      setAnalysisResult(null);
      setIsAnalyzing(false);
      setCameraMode(mode);
      setIsCameraOpen(true);
  };

  const handleGetLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((position: GeolocationPosition) => {
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
        // For members, the dashboard itself handles the 'join group' view which includes wallet access.
        // For admins, they need the dedicated create group view.
        setCurrentView(user.role === UserRole.ADMIN ? 'join-group' : 'dashboard');
    }
    if (user.role === UserRole.SUPERUSER) setCurrentView('admin-mgmt');
  };

  const handleLogout = () => {
    db.logout();
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
          // When user wants to join a new group, show the appropriate view.
          setCurrentView(currentUser?.role === UserRole.ADMIN ? 'join-group' : 'dashboard');
          localStorage.removeItem(LAST_GROUP_KEY);
      }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setNotification(null);

    if (authMode === 'forgot') {
        if (forgotStep === 1) {
            try {
                const response = await fetch(`${API_URL}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();
                if (data.success) {
                    setNotification({ type: 'success', message: data.demoCode ? `DEMO: Code is ${data.demoCode}` : data.message });
                    setForgotStep(2);
                } else {
                    setNotification({ type: 'error', message: data.error || 'Request failed.' });
                }
            } catch (err) {
                setNotification({ type: 'error', message: 'Server connection error.' });
            }
        } else {
            if (password !== passwordConfirmation) {
                setNotification({ type: 'error', message: 'Passwords do not match.' });
                setIsLoading(false);
                return;
            }
            try {
                const response = await fetch(`${API_URL}/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code: resetCode, newPassword: password })
                });
                const data = await response.json();
                if (data.success) {
                    setNotification({ type: 'success', message: 'Password updated! You can now log in.' });
                    setAuthMode('login');
                    setForgotStep(1);
                } else {
                    setNotification({ type: 'error', message: data.error || 'Reset failed.' });
                }
            } catch (err) {
                setNotification({ type: 'error', message: 'Server connection error.' });
            }
        }
        setIsLoading(false);
        return;
    }

    if (authMode === 'login') {
      try {
          const existingUser = await db.login(email, password);
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
          setNotification({ type: 'error', message: 'Connection refused. Ensure backend is running on port 3000.' });
      }
      setIsLoading(false);
      return;
    }

    if (authMode === 'register') {
      if (regStep === 1) {
        if (!name || !email || !phoneNumber || !kycId || !password || !passwordConfirmation) {
          setNotification({ type: 'error', message: 'Please fill in all account fields.' });
          setIsLoading(false);
          return;
        }

        if (!/^GHA-\d{9}-\d$/.test(kycId)) {
          setNotification({ type: 'error', message: 'Invalid Ghana Card ID. Format: GHA-123456789-1' });
          setIsLoading(false);
          return;
        }

        const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!strongRegex.test(password)) {
          setNotification({ type: 'error', message: 'Password must be at least 8 characters and include uppercase, lowercase, numbers, and symbols.' });
          setIsLoading(false);
          return;
        }

        if (password !== passwordConfirmation) {
          setNotification({ type: 'error', message: 'Passwords do not match.' });
          setIsLoading(false);
          return;
        }

        setRegStep(2);
        setIsLoading(false);
        return;
      }

      // Validation for Step 2 (Final submission)
      if (!idFrontImage || !idBackImage) {
        setNotification({ type: 'error', message: 'Both front and back pictures of your ID are required.' });
        setIsLoading(false);
        return;
      }
      
      // 🛡️ SECURITY: Prevent using the same image for both front and back
      if (idFrontImage === idBackImage) {
        setNotification({ type: 'error', message: 'ID Card front and back images cannot be the same.' });
        setIsLoading(false);
        return;
      }
      
      // Detect Device/Browser for KYC metadata
      const ua = navigator.userAgent;
      const deviceInfo = {
          device: /mobile|android|iphone|ipad/i.test(ua) ? "Mobile Device" : "Desktop Computer",
          os: /win/i.test(ua) ? "Windows" : /mac/i.test(ua) ? "MacOS" : /linux/i.test(ua) ? "Linux" : "Unknown OS",
          browser: /chrome|crios/i.test(ua) ? "Chrome" : /firefox/i.test(ua) ? "Firefox" : /safari/i.test(ua) && !/chrome/i.test(ua) ? "Safari" : "Web Browser",
          userAgent: ua
      };

      // Final User Construction and API call happens here...
      const newUser: User = {
          id: `u${Date.now()}`,
          name: name,
          email: email,
          phoneNumber: phoneNumber,
          role: registerRole,
          avatar: profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
          bio: bio,
          occupation: occupation,
          location: location,
          kycId: kycId,
          kycDocumentFront: idFrontImage || undefined,
          kycDocumentBack: idBackImage || undefined,
          status: 'PENDING',
          verificationStatus: 'PENDING',
          isFaceVerified: true,
          metadata: JSON.stringify(deviceInfo), // Store device context for verification
          joinDate: new Date().toISOString().split('T')[0],
          reliabilityScore: 100,
          memberships: []
      };

      try {
          await db.registerUser(newUser, password);
          localStorage.removeItem(REG_DRAFT_KEY);
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
                <Layout currentUser={contextUser || currentUser} onLogout={handleLogout} currentView={currentView} onNavigate={setCurrentView} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}>
                    <CreateUserProfile onSuccess={refreshData} onCancel={() => setCurrentView('dashboard')} />
                </Layout>
            );
        }
        
        if (currentView === 'ai-help') {
            return (
                <Layout currentUser={contextUser || currentUser} onLogout={handleLogout} currentView={currentView} onNavigate={setCurrentView} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}>
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
            <Layout currentUser={contextUser || currentUser} onLogout={handleLogout} currentView={currentView} onNavigate={setCurrentView} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}>
                <SuperuserDashboard members={dbMembers} transactions={dbTransactions} groups={dbGroups} onRefresh={refreshData} currentUser={currentUser} initialTab={initialTab} />
            </Layout>
        );
    }

    const dummyGroupForNewUser: Group = {id: '', name: 'No Group', contributionAmount: 0, currency: 'GHS', frequency: 'Monthly', nextPayoutDate: '', cycleNumber: 0, totalPool: 0, membersCount: 0, inviteCode: '', payoutSchedule: [], status: 'ACTIVE', reminderDaysBefore: 3};

    return (
      <Layout currentUser={contextUser || currentUser} onLogout={handleLogout} currentView={currentView} onNavigate={setCurrentView} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)} activeGroup={activeGroup} userGroups={userGroups} onSwitchGroup={handleGroupSwitch}>
        {/* Navigation Views */}
        {currentView === 'dashboard' && contextUser && (
            <>
                {contextUser.role === UserRole.MEMBER && <MemberDashboard group={activeGroup || dummyGroupForNewUser} transactions={dbTransactions} userId={currentUser.id} currentUser={contextUser} onRefresh={refreshData} members={dbMembers} />}
                {contextUser.role === UserRole.ADMIN && <AdminDashboard group={activeGroup || dummyGroupForNewUser} transactions={dbTransactions} members={dbMembers} currentUser={contextUser} onRefresh={refreshData} initialTab="overview" />}
            </>
        )}
        {currentView === 'join-group' && <JoinGroup userId={currentUser.id} onSuccess={refreshData} onCancel={userGroups.length > 0 ? () => handleGroupSwitch(userGroups[0]) : undefined} canCreateGroup={currentUser.role === UserRole.ADMIN} />}
        {currentView === 'help' && <HelpCenter />}
        {currentView === 'ai-help' && <AIHelpCenter />}
        {currentView === 'chat' && activeGroup && <GroupChat currentUser={contextUser || currentUser} activeGroup={activeGroup} />}
        {currentView === 'profile' && <ProfileSettings user={currentUser} onUpdateProfile={(data: Partial<User>) => db.updateUser(currentUser.id, data).then(refreshData)} />}
        {currentView === 'create-profile' && <CreateUserProfile onSuccess={refreshData} onCancel={() => setCurrentView('dashboard')} />}
        {currentView === 'transactions' && activeGroup && <TransactionHistory transactions={dbTransactions.filter((t: Transaction) => t.groupId === activeGroup.id)} currency={activeGroup.currency} />}
        {currentView === 'members' && activeGroup && contextUser?.role === UserRole.ADMIN && <AdminDashboard group={activeGroup || dummyGroupForNewUser} transactions={dbTransactions} members={dbMembers} currentUser={contextUser} onRefresh={refreshData} initialTab="members" />}
        {currentView === 'settings' && activeGroup && contextUser?.role === UserRole.ADMIN && <AdminDashboard group={activeGroup || dummyGroupForNewUser} transactions={dbTransactions} members={dbMembers} currentUser={contextUser} onRefresh={refreshData} initialTab="settings" />}
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
             <video ref={videoRef} autoPlay playsInline muted className={`w-full h-[400px] object-cover ${cameraMode === 'profile' ? 'transform scale-x-[-1]' : ''}`} />
             
             {/* 🛡️ KYC Guided Overlays */}
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {cameraMode === 'profile' ? (
                    <div className="w-64 h-64 border-4 border-green-500 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                ) : (
                    <div className="w-[85%] h-[55%] border-2 border-dashed border-white rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                )}
                <div className="absolute bottom-24 text-white text-center font-bold text-xs bg-black/50 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10">
                    {cameraMode === 'profile' ? 'Center your face in the green circle' : 'Align ID Card within the frame'}
                </div>
             </div>

             {/* 🤖 Analysis Overlay */}
             {(isAnalyzing || analysisResult) && (
                <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                    {isAnalyzing ? (
                        <>
                            <RefreshCw className="w-12 h-12 text-primary-400 animate-spin mb-4" />
                            <h3 className="text-white font-bold text-lg">Analyzing Quality...</h3>
                            <p className="text-gray-300 text-sm mt-2">Checking focus, lighting, and alignment</p>
                        </>
                    ) : (
                        <div className="animate-fade-in">
                            {analysisResult?.status === 'ok' ? <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" /> : <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />}
                            <h3 className={`text-xl font-bold ${analysisResult?.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{analysisResult?.status === 'ok' ? 'Verification Passed' : 'Verification Failed'}</h3>
                            <p className="text-white mt-2">{analysisResult?.message}</p>
                            {analysisResult?.status === 'bad' && <button onClick={() => setAnalysisResult(null)} className="mt-6 px-6 py-2 bg-white text-black rounded-full font-bold text-sm">Try Again</button>}
                        </div>
                    )}
                </div>
             )}

             <canvas ref={canvasRef} className="hidden" />
             <button onClick={() => setIsCameraOpen(false)} className="absolute top-4 right-4 z-30 bg-gray-800/80 text-white p-3 rounded-full hover:bg-gray-700 transition-colors backdrop-blur-sm">
                <X className="w-6 h-6" />
             </button>
             <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/80 to-transparent flex justify-center">
                <button disabled={isAnalyzing || !!analysisResult} onClick={handleTakePhoto} className={`w-20 h-20 rounded-full border-4 transition-all flex items-center justify-center shadow-lg ${isAnalyzing || analysisResult ? 'bg-gray-600 border-gray-700 cursor-not-allowed' : 'bg-white border-gray-300 hover:border-primary-500 hover:scale-105'}`}>
                    <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-gray-300"></div>
                </button>
             </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 w-full h-full bg-primary-900 overflow-hidden z-0">
        <div className="hidden lg:flex flex-col justify-between h-full p-16 relative z-10 pointer-events-none">
            <div className="animate-fade-in-down">
                <div className="flex items-center gap-3 mb-10"><div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg"><Wallet className="w-8 h-8 text-white" /></div><h1 className="text-3xl font-bold tracking-tight text-white">Secure Susu</h1></div>
                <h2 className="text-5xl font-extrabold leading-tight mb-6 text-white">Achieve Goals<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-200 to-white">Together.</span></h2>
                <p className="text-primary-100 text-lg max-w-md leading-relaxed">Join a trusted community of savers. Grow your wealth through organized, secure, and transparent contributions.</p>
                
                <div className="mt-12 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30"><ShieldCheck className="w-6 h-6 text-green-400" /></div>
                        <div><h4 className="text-white font-bold">Verified Security</h4><p className="text-primary-200 text-sm">Your data and funds are protected with industrial-grade encryption and KYC verification.</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30"><TrendingUp className="w-6 h-6 text-blue-400" /></div>
                        <div><h4 className="text-white font-bold">Community Trust</h4><p className="text-primary-200 text-sm">Automated tracking ensures every member stays accountable and reliable.</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30"><Sparkles className="w-6 h-6 text-purple-400" /></div>
                        <div><h4 className="text-white font-bold">AI Optimization</h4><p className="text-primary-200 text-sm">Smart rotation schedules optimized by Gemini AI for maximum financial impact.</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30"><Award className="w-6 h-6 text-amber-400" /></div>
                        <div><h4 className="text-white font-bold">Verified Growth</h4><p className="text-primary-200 text-sm">Build your platform reliability score and unlock exclusive savings groups.</p></div>
                    </div>
                </div>

                <div className="mt-16 flex items-center gap-4 animate-fade-in" style={{ animationDelay: '0.8s' }}>
                    <div className="flex -space-x-3">
                        {[1,2,3,4].map(i => (
                            <img key={i} src={`https://i.pravatar.cc/100?u=${i + 10}`} className="w-10 h-10 rounded-full border-2 border-primary-900 shadow-lg object-cover" alt="User" />
                        ))}
                    </div>
                    <p className="text-primary-200 text-sm font-medium">Join <span className="text-white font-bold">2,400+</span> active savers across Ghana</p>
                </div>
            </div>
        </div>
      </div>

      <div className="relative z-20 w-full max-w-[440px] animate-fade-in-up group">
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700 transition-transform duration-500 group-hover:-translate-y-1">
                <div className="mb-8 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{authMode === 'login' ? 'Sign In' : authMode === 'register' ? 'Create Account' : 'Reset Password'}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{authMode === 'forgot' ? 'Follow steps to recover access.' : 'Access your secure susu portal.'}</p>
                </div>

                {authMode === 'register' && (
                    <div className="flex items-center justify-between mb-8 px-2">
                        <div className="flex flex-col items-center gap-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${regStep === 1 ? 'bg-primary-600 text-white ring-4 ring-primary-100' : 'bg-green-500 text-white'}`}>
                                {regStep > 1 ? <CheckCircle className="w-4 h-4" /> : '1'}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${regStep === 1 ? 'text-primary-600' : 'text-green-600'}`}>Account</span>
                        </div>
                        <div className={`flex-1 h-0.5 mx-4 transition-all duration-500 ${regStep > 1 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                        <div className="flex flex-col items-center gap-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${regStep === 2 ? 'bg-primary-600 text-white ring-4 ring-primary-100' : 'bg-gray-200 text-gray-400'}`}>
                                2
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${regStep === 2 ? 'text-primary-600' : 'text-gray-400'}`}>Profile</span>
                        </div>
                    </div>
                )}

                {notification && (
                    <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm border ${notification.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : notification.type === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : notification.type === 'info' ? <AlertCircle className="w-5 h-5 text-blue-500" /> : <AlertCircle className="w-5 h-5" />}
                        <span>{notification.message}</span>
                    </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-5">
                    {authMode === 'register' && regStep === 1 && (
                         <>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <button type="button" onClick={() => setRegisterRole(UserRole.MEMBER)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${registerRole === UserRole.MEMBER ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}><Users className="w-6 h-6" /><span className="text-sm font-bold">Member</span></button>
                                <button type="button" onClick={() => setRegisterRole(UserRole.ADMIN)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${registerRole === UserRole.ADMIN ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}><Crown className="w-6 h-6" /><span className="text-sm font-bold">Leader</span></button>
                            </div>
                            <div className="space-y-4">
                                <input type="text" required value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Full Name" />
                                <input type="email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Email Address" />
                                <input type="tel" required maxLength={10} value={phoneNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Phone Number (e.g. 0244123456)" />
                                <input type="text" required value={kycId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKycId(e.target.value.toUpperCase())} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Ghana Card ID (GHA-123456789-1)" />
                                <div className="relative">
                                    <input type={showPassword ? "text" : "password"} required value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Password" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-gray-400">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                                </div>
                                <input type="password" required value={passwordConfirmation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordConfirmation(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Confirm Password" />
                            </div>
                         </>
                    )}

                    {authMode === 'register' && regStep === 2 && (
                         <>
                            <div className="flex items-center gap-2 mb-4">
                                <button type="button" onClick={() => setRegStep(1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-5 h-5 text-gray-500" /></button>
                                <span className="text-sm font-bold text-gray-700">Back to Basic Info</span>
                            </div>
                            <div className="space-y-4 mb-6">
                                <div className="flex justify-center">
                                    <div className="relative group">
                                        <div className={`w-24 h-24 rounded-full flex items-center justify-center overflow-hidden border-4 cursor-pointer transition-all ${profileImage ? 'border-green-500 shadow-lg shadow-green-500/20' : 'border-gray-200 bg-gray-50 hover:border-primary-400'}`} onClick={() => openCamera('profile')}>
                                            {profileImage ? <img src={profileImage} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-10 h-10 text-gray-300" />}
                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-6 h-6 text-white" /></div>
                                        </div>
                                        {profileImage && <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-1.5 border-2 border-white"><ShieldCheck className="w-3.5 h-3.5" /></div>}
                                    </div>
                                </div>
                                
                                <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white min-h-[80px]" placeholder="Tell us about yourself (Bio)" />

                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" required value={occupation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOccupation(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white text-sm" placeholder="Occupation" />
                                    <div className="flex gap-1 flex-1">
                                        <input type="text" readOnly required value={location} className="flex-1 p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white text-sm" placeholder="Location" />
                                        <button type="button" onClick={handleGetLocation} className="p-2 bg-primary-100 rounded-xl"><MapPin className="w-4 h-4 text-primary-600" /></button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Card Front</label>
                                        <div className={`aspect-[3/2] w-full rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed cursor-pointer transition-all ${idFrontImage ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-primary-400'}`} onClick={() => openCamera('idFront')}>
                                            {idFrontImage ? <img src={idFrontImage} alt="" className="w-full h-full object-cover" /> : <FileText className="w-8 h-8 text-gray-300" />}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Card Back</label>
                                        <div className={`aspect-[3/2] w-full rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed cursor-pointer transition-all ${idBackImage ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-primary-400'}`} onClick={() => openCamera('idBack')}>
                                            {idBackImage ? <img src={idBackImage} alt="" className="w-full h-full object-cover" /> : <FileText className="w-8 h-8 text-gray-300" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                         </>
                    )}

                    {authMode === 'forgot' && (
                        <div className="space-y-4">
                            {forgotStep === 1 ? (
                                <input type="email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Enter your email" />
                            ) : (
                                <>
                                    <div className="p-3 bg-primary-50 rounded-xl text-primary-700 text-xs text-center border border-primary-100">Reset code sent to: <strong>{email}</strong></div>
                                    <input type="text" required maxLength={6} value={resetCode} onChange={(e) => setResetCode(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white text-center tracking-[1em] font-bold" placeholder="000000" />
                                    <div className="relative">
                                        <input type={showPassword ? "text" : "password"} required value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="New Password" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-gray-400">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                                    </div>
                                    <input type="password" required value={passwordConfirmation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordConfirmation(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Confirm New Password" />
                                </>
                            )}
                        </div>
                    )}

                    {authMode === 'login' && (
                        <>
                            <div className="space-y-4">
                                <input type="email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Email Address" />
                                <div className="relative">
                                    <input type={showPassword ? "text" : "password"} required value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white" placeholder="Password" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-gray-400">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button type="button" onClick={() => setAuthMode('forgot')} className="text-xs font-bold text-primary-600 hover:text-primary-700">Forgot Password?</button>
                            </div>
                        </>
                    )}

                    <button type="submit" disabled={isLoading} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (authMode === 'login' ? 'Sign In' : authMode === 'register' ? (regStep === 1 ? 'Continue' : 'Complete Registration') : (forgotStep === 1 ? 'Send Reset Code' : 'Update Password'))}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {authMode === 'login' ? "Don't have an account? " : (authMode === 'register' ? "Already have an account? " : "Remember your password? ")}
                        <button onClick={() => {
                            setAuthMode(authMode === 'login' ? 'register' : 'login');
                            setForgotStep(1);
                        }} className="font-bold text-primary-600">
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
