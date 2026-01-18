

import React, { useState, useRef, useEffect } from 'react';
import { User, NotificationPreferences, SoundType } from '../types';
import { Camera, Save, MapPin, Loader2, X, User as UserIcon, Briefcase, Check, Bell, Play, Volume2, Phone, ShieldCheck, Lock } from 'lucide-react';

interface ProfileSettingsProps {
  user: User;
  onUpdateProfile: (data: Partial<User>) => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user, onUpdateProfile }) => {
  const [name, setName] = useState(user.name);
  const [occupation, setOccupation] = useState(user.occupation || '');
  const [location, setLocation] = useState(user.location || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [avatar, setAvatar] = useState(user.avatar);
  const [preferences, setPreferences] = useState<NotificationPreferences>(user.preferences || {
    payout: 'default',
    contribution: 'default',
    request: 'default',
    system: 'default'
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user.twoFactorEnabled || false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
        const timer = setTimeout(() => setSuccessMessage(''), 3000);
        return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Camera logic
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      if (isCameraOpen) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
          console.error("Camera error", err);
          setIsCameraOpen(false);
          alert('Could not access camera.');
        }
      }
    };
    if (isCameraOpen) startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [isCameraOpen]);

  const handleTakePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        setAvatar(canvasRef.current.toDataURL('image/png'));
        setIsCameraOpen(false);
      }
    }
  };

  const handleGetLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;
            setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)} (Updated)`);
            setIsLocating(false);
        }, (error) => {
            console.error("Error getting location", error);
            setTimeout(() => {
                setLocation('5.6037° N, 0.1870° W (Accra, Ghana)');
                setIsLocating(false);
            }, 1000);
        });
    } else {
         setIsLocating(false);
         alert('Geolocation is not supported by this browser.');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate network request
    setTimeout(() => {
      onUpdateProfile({ name, occupation, location, avatar, preferences, phoneNumber, twoFactorEnabled });
      setIsLoading(false);
      setSuccessMessage('Profile updated successfully!');
    }, 1000);
  };

  const playNotificationSound = (sound: string) => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    if (sound === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (sound === 'chime') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 1.5);
        osc.start(now);
        osc.stop(now + 1.5);
    } else if (sound === 'alert') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(180, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else {
        // Default beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: SoundType) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-black rounded-2xl overflow-hidden shadow-2xl">
             <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-[400px] object-cover transform scale-x-[-1]" 
             />
             <canvas ref={canvasRef} className="hidden" />
             
             <button 
                onClick={() => setIsCameraOpen(false)}
                className="absolute top-4 right-4 bg-gray-800/50 text-white p-2 rounded-full hover:bg-gray-800 transition-colors"
             >
                <X className="w-6 h-6" />
             </button>

             <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center">
                <button 
                    onClick={handleTakePhoto}
                    className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:border-primary-500 hover:scale-105 transition-all flex items-center justify-center"
                >
                    <div className="w-12 h-12 rounded-full bg-gray-100 border-2 border-gray-300"></div>
                </button>
             </div>
          </div>
          <p className="text-white mt-4 text-sm">Position your face in the frame and tap capture</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Account Settings</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Update your personal information and profile details.</p>
                </div>

                {successMessage && (
                    <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-6 py-3 border-b border-green-100 dark:border-green-900 flex items-center gap-2">
                        <Check className="w-4 h-4" /> {successMessage}
                    </div>
                )}

                <form onSubmit={handleSave} className="p-6 space-y-6">
                    {/* Profile Picture */}
                    <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                        <div className="relative group">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary-100 dark:border-gray-600">
                            <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsCameraOpen(true)}
                            className="absolute bottom-0 right-0 bg-primary-600 text-white p-1.5 rounded-full shadow-md hover:bg-primary-700 transition-colors"
                            title="Change Photo"
                        >
                            <Camera className="w-4 h-4" />
                        </button>
                        </div>
                        <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">Profile Photo</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                This image will be visible to other group members.
                                Click the camera icon to take a new selfie.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                            <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            required
                            />
                        </div>
                        </div>

                        <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Occupation</label>
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                            <input
                            type="text"
                            value={occupation}
                            onChange={(e) => setOccupation(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                        </div>

                        <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                            <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="024 123 4567"
                            />
                        </div>
                        </div>

                        <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                        <div className="relative flex gap-2">
                            <div className="relative flex-1">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                                <input
                                type="text"
                                value={location}
                                readOnly
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-not-allowed"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleGetLocation}
                                disabled={isLocating}
                                className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-4 rounded-lg flex items-center justify-center transition-colors"
                                title="Update Location"
                            >
                                {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                            </button>
                        </div>
                        </div>

                        <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                        <input
                            type="email"
                            value={user.email}
                            readOnly
                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email address cannot be changed.</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-green-500" /> Security
                        </h4>
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">Two-Factor Authentication (2FA)</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Require a code when logging in from new devices.</p>
                            </div>
                            <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                <input 
                                    type="checkbox" 
                                    name="toggle" 
                                    id="toggle" 
                                    checked={twoFactorEnabled}
                                    onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-6"
                                />
                                <label 
                                    htmlFor="toggle" 
                                    className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer border transition-colors ${twoFactorEnabled ? 'bg-primary-600 border-primary-600' : 'bg-gray-300 border-gray-300 dark:bg-gray-600 dark:border-gray-600'}`}
                                ></label>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-70"
                        >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                        </button>
                    </div>
                </form>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden sticky top-6">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Notification Sounds</h3>
                </div>
                <div className="p-6 space-y-6">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Customize the alert sounds for different app events.</p>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">Contribution Alerts</label>
                            <div className="flex gap-2">
                                <select 
                                    value={preferences.contribution}
                                    onChange={(e) => updatePreference('contribution', e.target.value as SoundType)}
                                    className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm p-2.5 outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                                >
                                    <option value="default">Default Beep</option>
                                    <option value="chime">Soft Chime</option>
                                    <option value="coin">Coin Drop</option>
                                    <option value="alert">Sharp Alert</option>
                                </select>
                                <button 
                                    type="button"
                                    onClick={() => playNotificationSound(preferences.contribution)}
                                    className="p-2.5 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded-lg transition-colors"
                                    title="Preview Sound"
                                >
                                    <Play className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">Payout Alerts</label>
                            <div className="flex gap-2">
                                <select 
                                    value={preferences.payout}
                                    onChange={(e) => updatePreference('payout', e.target.value as SoundType)}
                                    className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm p-2.5 outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                                >
                                    <option value="default">Default Beep</option>
                                    <option value="chime">Soft Chime</option>
                                    <option value="coin">Coin Drop</option>
                                    <option value="alert">Sharp Alert</option>
                                </select>
                                <button 
                                    type="button"
                                    onClick={() => playNotificationSound(preferences.payout)}
                                    className="p-2.5 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded-lg transition-colors"
                                    title="Preview Sound"
                                >
                                    <Play className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">Member Requests</label>
                            <div className="flex gap-2">
                                <select 
                                    value={preferences.request}
                                    onChange={(e) => updatePreference('request', e.target.value as SoundType)}
                                    className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm p-2.5 outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                                >
                                    <option value="default">Default Beep</option>
                                    <option value="chime">Soft Chime</option>
                                    <option value="coin">Coin Drop</option>
                                    <option value="alert">Sharp Alert</option>
                                </select>
                                <button 
                                    type="button"
                                    onClick={() => playNotificationSound(preferences.request)}
                                    className="p-2.5 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded-lg transition-colors"
                                    title="Preview Sound"
                                >
                                    <Play className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">System Updates</label>
                            <div className="flex gap-2">
                                <select 
                                    value={preferences.system}
                                    onChange={(e) => updatePreference('system', e.target.value as SoundType)}
                                    className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm p-2.5 outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                                >
                                    <option value="default">Default Beep</option>
                                    <option value="chime">Soft Chime</option>
                                    <option value="coin">Coin Drop</option>
                                    <option value="alert">Sharp Alert</option>
                                </select>
                                <button 
                                    type="button"
                                    onClick={() => playNotificationSound(preferences.system)}
                                    className="p-2.5 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded-lg transition-colors"
                                    title="Preview Sound"
                                >
                                    <Play className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                        <Volume2 className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>Remember to check your device volume. These settings apply only to this browser.</p>
                    </div>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};