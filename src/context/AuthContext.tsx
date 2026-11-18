import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup,
  signInWithRedirect, 
  signOut,
  sendSignInLinkToEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  AuthProvider as FirebaseAuthProvider,
  AuthCredential,
  FacebookAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  linkWithCredential,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, googleProvider, facebookProvider, githubProvider, handleFirestoreError, OperationType } from '../firebase/config';
import { UserDevice, DeviceType, AppSettings, AppUser, LoginSession, EmailVerificationRecord, AuthProviderType } from '../types';
import { detectDeviceType, generateDefaultDeviceName, getRandomColor, isSmartTv, getRecommendedTvDpi, detectBrowserInfo, detectLocationInfo, fetchSpecificLocation } from '../utils/device';
import { 
  CustomAuthAccount, 
  hashPassword, 
  getAccountKey,
  getEmailKey, 
  generateSalt, 
  generateUid,
  normalizePhoneNumber
} from '../utils/authHelper';
import { checkUserBanStatus, isRealEmail } from '../utils/devModeration';
import { pickLang, getLocaleTag } from './LanguageContext';

const getActiveAppLang = (): string => {
  try {
    return typeof window !== 'undefined' ? (localStorage.getItem('app_language') || 'vi') : 'vi';
  } catch {
    return 'vi';
  }
};
const pickAuth = (vi: string, en: string, zh?: string): string =>
  pickLang(getActiveAppLang(), vi, en, zh);

interface AuthContextType {
  currentUser: AppUser | null;
  userProfile: UserDevice | null;
  settings: AppSettings;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
  loginWithGithub: () => Promise<void>;
  pendingCredentialLink: {
    email: string;
    providerLabel: string;
    suggestedProvider: 'google' | 'github' | 'facebook' | null;
  } | null;
  confirmPendingCredentialLink: (existingProvider: 'google' | 'facebook' | 'github') => Promise<void>;
  clearPendingCredentialLink: () => void;
  sendPhoneLoginOtp: (phoneNumber: string, recaptchaContainerId: string) => Promise<void>;
  confirmPhoneLoginOtp: (otpCode: string) => Promise<void>;
  resetPhoneLoginState: () => void;
  loginWithEmail: (emailOrUsername: string, pass: string) => Promise<void>;
  loginWithAccount: (usernameOrEmail: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, deviceName?: string) => Promise<void>;
  registerWithAccount: (
    dataOrUsername: string | {
      username: string;
      pass: string;
      email?: string;
      phone?: string;
      dob?: string;
      gender?: 'Nam' | 'Nữ' | 'Không Muốn Trả Lời' | string;
      deviceName?: string;
    },
    passArg?: string,
    extra?: {
      email?: string;
      phone?: string;
      dob?: string;
      gender?: 'Nam' | 'Nữ' | 'Không Muốn Trả Lời' | string;
      deviceName?: string;
    }
  ) => Promise<void>;
  loginAsGuest: (customDisplayName?: string, customDeviceName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  updateDisplayName: (newDisplayName: string) => Promise<void>;
  linkEmail: (newEmail: string) => Promise<void>;
  linkPhoneNumber: (newPhone: string) => Promise<string>;
  sendEmailVerificationCode: (targetEmail: string) => Promise<{
    code: string;
    expiresAt: string;
    expiresTimestamp: number;
    emailMessage: string;
    recipientEmail: string;
    isRealSmtp?: boolean;
    serverMessage?: string | null;
  }>;
  verifyEmailCodeAndLink: (targetEmail: string, inputCode: string) => Promise<void>;
  getLoginSessions: () => Promise<LoginSession[]>;
  logoutSession: (sessionId: string) => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  syncGoogleProfilePhoto: () => Promise<string | null>;
  linkWithGoogleAccount: () => Promise<{ email: string; photoURL: string | null } | null>;
  updatePresence: (uid?: string, profile?: Partial<UserDevice>) => Promise<void>;
  loginWithSyncPayload: (payload: { userSession: AppUser; profileData: UserDevice; settings?: Partial<AppSettings> }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const getClientDeviceId = (): string => {
  if (typeof window === 'undefined') return 'server_node';
  let id = localStorage.getItem('cloudsend_client_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('cloudsend_client_device_id', id);
  }
  return id;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Restore session synchronously from localStorage to prevent UI flashing or logout on F5
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('cloudsend_custom_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.uid) return parsed;
      } catch {
        // fallback
      }
    }
    return null;
  });

  const [userProfile, setUserProfile] = useState<UserDevice | null>(() => {
    if (typeof window === 'undefined') return null;
    const savedProfile = localStorage.getItem('cloudsend_user_profile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed?.uid) return parsed;
      } catch {
        // fallback
      }
    }
    return null;
  });

  // If a session already exists locally, do not block with full screen loading
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem('cloudsend_custom_session');
  });
  
  const currentUserRef = useRef<AppUser | null>(currentUser);
  const isLinkingAccountRef = useRef<boolean>(false);
  const isExplicitGoogleLoginRef = useRef<boolean>(false);
  const isSuppressingAuthListenerRef = useRef<boolean>(false);
  const phoneConfirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const pendingCredentialRef = useRef<{
    credential: AuthCredential;
    email: string;
    providerLabel: string;
  } | null>(null);
  const [pendingCredentialLink, setPendingCredentialLink] = useState<{
    email: string;
    providerLabel: string;
    suggestedProvider: 'google' | 'github' | 'facebook' | null;
  } | null>(null);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Keep user profile persisted in localStorage
  useEffect(() => {
    if (userProfile) {
      try {
        localStorage.setItem('cloudsend_user_profile', JSON.stringify(userProfile));
      } catch {
        // ignore
      }
    }
  }, [userProfile]);

  const defaultDeviceType = detectDeviceType();
  const [settings, setSettings] = useState<AppSettings>(() => {
    const isTv = isSmartTv();
    const isTvStored = typeof window !== 'undefined' && localStorage.getItem('cloudsend_tv_mode') === 'true';
    const detected = detectDeviceType();
    const isTvEffective = isTv || isTvStored;
    const effectiveType: DeviceType = isTvEffective ? 'tv' : detected;
    const defaultDpi = isTvEffective ? getRecommendedTvDpi() : 1.0;

    const saved = typeof window !== 'undefined' ? localStorage.getItem('cloudsend_settings') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const tvActive = parsed.tvModeEnabled ?? isTvEffective;
        const currentType: DeviceType = tvActive ? 'tv' : detected;
        return {
          ...parsed,
          deviceType: currentType,
          tvModeEnabled: tvActive,
          tvDpiScale: parsed.tvDpiScale || (tvActive ? getRecommendedTvDpi() : 1.0),
          autoAccept: tvActive ? (parsed.autoAccept ?? true) : (parsed.autoAccept ?? false),
        };
      } catch {
        // fallback
      }
    }
    return {
      deviceName: generateDefaultDeviceName(effectiveType),
      deviceType: effectiveType,
      avatarColor: getRandomColor(),
      autoAccept: isTvEffective,
      soundEnabled: true,
      tvModeEnabled: isTvEffective,
      tvDpiScale: defaultDpi,
      dpiScaleMode: isTvEffective ? 'tv_150' : 'auto',
    };
  });

  const settingsRef = useRef<AppSettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Keep deviceType synchronized if window dimensions / hardware context changes
  useEffect(() => {
    const handleResize = () => {
      if (settingsRef.current.tvModeEnabled || isSmartTv()) {
        return; // Retain TV mode if enabled or on TV
      }
      const current = detectDeviceType();
      if (current !== settingsRef.current.deviceType) {
        setSettings(prev => ({ ...prev, deviceType: current }));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('cloudsend_settings', JSON.stringify(settings));
  }, [settings]);

  // Handle Presence Heartbeat in Firestore using latest settings & real detected hardware
  const updatePresence = async (uid?: string, profile?: Partial<UserDevice>) => {
    try {
      const targetUid = uid || currentUserRef.current?.uid;
      if (!targetUid) return;
      const currentSettings = settingsRef.current;
      const currentHwType = currentSettings.deviceType || (isSmartTv() ? 'tv' : detectDeviceType());
      const currentUsr = currentUserRef.current;
      const avatarImg = currentSettings.customAvatarUrl || profile?.customAvatarUrl || currentUsr?.photoURL;
      const deviceId = getClientDeviceId();
      const connectCode = deviceId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
      const presenceKey = `${targetUid}_${deviceId}`;
      const presenceRef = doc(db, 'presence', presenceKey);
      await setDoc(presenceRef, {
        uid: targetUid,
        deviceId,
        connectCode,
        displayName: profile?.displayName || currentUsr?.displayName || currentUsr?.email?.split('@')[0] || pickAuth('Người dùng', 'User', '用户'),
        deviceName: currentSettings.deviceName || profile?.deviceName || pickAuth('Thiết bị', 'Device', '设备'),
        deviceType: currentHwType,
        avatarColor: currentSettings.avatarColor || profile?.avatarColor || '#10B981',
        customAvatarUrl: avatarImg || null,
        status: 'online',
        lastSeen: new Date().toISOString(),
        lastSeenMs: Date.now(),
        lastSeenServer: serverTimestamp(),
      }, { merge: true });

      // Synchronize latest active hardware & online timestamp to users record
      const userDocRef = doc(db, 'users', targetUid);
      setDoc(userDocRef, { 
        deviceType: currentHwType,
        lastSeen: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        lastBrowser: detectBrowserInfo(),
        status: 'online',
      }, { merge: true }).catch(() => {});
    } catch (err) {
      console.warn('Presence update error:', err);
    }
  };

  const removePresence = async (uid: string) => {
    try {
      const deviceId = getClientDeviceId();
      const presenceKey = `${uid}_${deviceId}`;
      const presenceRef = doc(db, 'presence', presenceKey);
      await setDoc(presenceRef, {
        status: 'offline',
        lastSeen: new Date().toISOString(),
        lastSeenMs: Date.now(),
        lastSeenServer: serverTimestamp(),
      }, { merge: true });
      await deleteDoc(presenceRef).catch(() => {});
      await deleteDoc(doc(db, 'presence', uid)).catch(() => {});
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Immediately announce presence if user is restored from localStorage
    if (currentUser?.uid) {
      updatePresence(currentUser.uid, userProfile || undefined);
    }

    // Listen to Electron desktop Google login IPC bridge
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onGoogleLogin) {
      (window as any).electronAPI.onGoogleLogin(async (data: { uid: string; email: string; displayName: string; photoURL: string }) => {
        if (data && data.uid) {
          const appUser: AppUser = {
            uid: data.uid,
            email: data.email || `${data.uid}@cloudsend.local`,
            displayName: data.displayName || data.email?.split('@')[0] || pickAuth('Người dùng Google', 'Google User', 'Google 用户'),
            photoURL: data.photoURL || null,
          };
          setCurrentUser(appUser);
          currentUserRef.current = appUser;
          localStorage.setItem('cloudsend_custom_session', JSON.stringify(appUser));

          const profileData: UserDevice = {
            uid: data.uid,
            email: data.email || '',
            displayName: data.displayName || pickAuth('Người dùng Google', 'Google User', 'Google 用户'),
            deviceName: settingsRef.current.deviceName,
            deviceType: detectDeviceType(),
            avatarColor: settingsRef.current.avatarColor,
            customAvatarUrl: data.photoURL || undefined,
            createdAt: new Date().toISOString(),
          };
          setUserProfile(profileData);
          localStorage.setItem('cloudsend_user_profile', JSON.stringify(profileData));
          if (data.photoURL) {
            setSettings(prev => ({ ...prev, customAvatarUrl: data.photoURL }));
          }

          try {
            await setDoc(doc(db, 'users', data.uid), profileData, { merge: true });
          } catch {}

          await updatePresence(data.uid, profileData);
          if (isMounted) setLoading(false);
        }
      });
    }

    const restoreCustomSession = async () => {
      const saved = localStorage.getItem('cloudsend_custom_session');
      if (saved) {
        try {
          const session: AppUser = JSON.parse(saved);
          if (session && session.uid) {
            // Check if user (or any synced email/phone/linked UID) is currently banned
            const banCheck = await checkUserBanStatus(session.email, session.uid, {
              phone: session.phone || session.linkedPhone,
              linkedEmail: session.linkedEmail,
              linkedUids: session.linkedUids,
            });
            if (banCheck.isBanned) {
              localStorage.removeItem('cloudsend_custom_session');
              localStorage.removeItem('cloudsend_user_profile');
              setCurrentUser(null);
              currentUserRef.current = null;
              setUserProfile(null);
              if (isMounted) setLoading(false);
              return;
            }

            if (!isMounted) return;
            setCurrentUser(session);
            currentUserRef.current = session;
            
            try {
              const userDocSnap = await getDoc(doc(db, 'users', session.uid));
              if (userDocSnap.exists() && isMounted) {
                const profileData = userDocSnap.data() as UserDevice;
                // Re-verify ban after loading latest phone / linkedEmail from Firestore
                const freshBanCheck = await checkUserBanStatus(profileData.email, session.uid, {
                  phone: profileData.phone || profileData.linkedPhone || profileData.phoneNumber,
                  linkedEmail: profileData.linkedEmail,
                  linkedUids: profileData.linkedUids,
                });
                if (freshBanCheck.isBanned) {
                  localStorage.removeItem('cloudsend_custom_session');
                  localStorage.removeItem('cloudsend_user_profile');
                  setCurrentUser(null);
                  currentUserRef.current = null;
                  setUserProfile(null);
                  if (isMounted) setLoading(false);
                  return;
                }

                setUserProfile(profileData);
                localStorage.setItem('cloudsend_user_profile', JSON.stringify(profileData));
                // Merge latest linkedEmail / phone / linkedUids from Firestore into active session
                const mergedLinkedUids = Array.from(new Set([
                  ...(session.linkedUids || []),
                  ...(profileData.linkedUids || []),
                  ...(profileData.googleUid ? [profileData.googleUid] : []),
                ].filter(Boolean)));
                const enrichedSession: AppUser = {
                  ...session,
                  email: profileData.linkedEmail || profileData.email || session.email,
                  linkedEmail: profileData.linkedEmail || session.linkedEmail,
                  phone: profileData.phone || profileData.linkedPhone || session.phone,
                  linkedPhone: profileData.linkedPhone || profileData.phone || session.linkedPhone,
                  linkedUids: mergedLinkedUids.length > 0 ? mergedLinkedUids : session.linkedUids,
                };
                setCurrentUser(enrichedSession);
                currentUserRef.current = enrichedSession;
                localStorage.setItem('cloudsend_custom_session', JSON.stringify(enrichedSession));

                const hasLocalSettings = Boolean(localStorage.getItem('cloudsend_settings'));
                if (!hasLocalSettings && profileData.deviceName) {
                  setSettings((prev) => ({
                    ...prev,
                    deviceName: profileData.deviceName,
                    deviceType: detectDeviceType(),
                    avatarColor: profileData.avatarColor || prev.avatarColor,
                  }));
                }
                await updatePresence(session.uid, profileData);
              } else {
                // User document not found in Firestore yet, announce with current session
                await updatePresence(session.uid);
              }
            } catch (err) {
              console.warn('Could not refresh custom session profile from firestore:', err);
              await updatePresence(session.uid);
            }
          }
        } catch {
          localStorage.removeItem('cloudsend_custom_session');
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (isLinkingAccountRef.current || isSuppressingAuthListenerRef.current) {
        // Account linking or explicit account switch is running - do not overwrite
        return;
      }

      if (user) {
        if (typeof window !== 'undefined' && window.location.search.includes('desktopAuth=true')) {
          window.location.href = `/auth-success?uid=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email || '')}&displayName=${encodeURIComponent(user.displayName || '')}&photoURL=${encodeURIComponent(user.photoURL || '')}`;
          return;
        }

        // Prevent a residual Firebase Auth Google session on this Chrome profile from hijacking
        // an explicitly logged-in ClSend custom account!
        if (!isExplicitGoogleLoginRef.current) {
          const savedRaw = localStorage.getItem('cloudsend_custom_session');
          if (savedRaw) {
            try {
              const savedSession: AppUser = JSON.parse(savedRaw);
              if (savedSession?.uid && (savedSession.authProvider === 'account' || savedSession.authProvider === 'sync' || savedSession.uid.startsWith('u_'))) {
                await restoreCustomSession();
                if (isMounted) setLoading(false);
                return;
              }
            } catch {}
          }
        }

        // Enforce Dev Ban Check on Firebase Auth (Email, UID, Phone)
        const normFirebasePhone = normalizePhoneNumber(user.phoneNumber);
        const banCheck = await checkUserBanStatus(user.email, user.uid, {
          phone: normFirebasePhone || null,
          linkedEmail: user.email || null,
        });
        if (banCheck.isBanned) {
          console.warn('User is banned by Dev:', banCheck.message);
          await signOut(auth);
          localStorage.removeItem('cloudsend_custom_session');
          localStorage.removeItem('cloudsend_user_profile');
          setCurrentUser(null);
          currentUserRef.current = null;
          setUserProfile(null);
          if (isMounted) setLoading(false);
          return;
        }

        // Detect Firebase Auth provider ('google' | 'facebook' | 'github' | 'phone')
        const rawProviderId = user.providerData?.[0]?.providerId || '';
        const detectedAuthProvider: AuthProviderType =
          rawProviderId === 'facebook.com'
            ? 'facebook'
            : rawProviderId === 'github.com'
            ? 'github'
            : rawProviderId === 'phone' || (!!normFirebasePhone && !user.email)
            ? 'phone'
            : 'google';

        // Discover any sibling ClSend account UIDs linked to this email or phone so cloud files & bans stay synced
        const discoveredLinkedUids = new Set<string>();
        const cleanAuthEmail = (user.email || '').trim().toLowerCase();
        const emailQueries: Promise<void>[] = [];
        if (cleanAuthEmail) {
          emailQueries.push(
            getDocs(query(collection(db, 'accounts'), where('linkedEmail', '==', cleanAuthEmail)))
              .then((snap) => snap.forEach((d) => { const uid = d.data()?.uid; if (uid && uid !== user.uid) discoveredLinkedUids.add(uid); }))
              .catch(() => {}),
            getDocs(query(collection(db, 'accounts'), where('email', '==', cleanAuthEmail)))
              .then((snap) => snap.forEach((d) => { const uid = d.data()?.uid; if (uid && uid !== user.uid) discoveredLinkedUids.add(uid); }))
              .catch(() => {}),
            getDocs(query(collection(db, 'users'), where('linkedEmail', '==', cleanAuthEmail)))
              .then((snap) => snap.forEach((d) => { if (d.id !== user.uid) discoveredLinkedUids.add(d.id); }))
              .catch(() => {})
          );
        }
        if (normFirebasePhone) {
          emailQueries.push(
            getDocs(query(collection(db, 'accounts'), where('phone', '==', normFirebasePhone)))
              .then((snap) => snap.forEach((d) => { const uid = d.data()?.uid; if (uid && uid !== user.uid) discoveredLinkedUids.add(uid); }))
              .catch(() => {}),
            getDocs(query(collection(db, 'users'), where('phone', '==', normFirebasePhone)))
              .then((snap) => snap.forEach((d) => { if (d.id !== user.uid) discoveredLinkedUids.add(d.id); }))
              .catch(() => {}),
            getDocs(query(collection(db, 'users'), where('linkedPhone', '==', normFirebasePhone)))
              .then((snap) => snap.forEach((d) => { if (d.id !== user.uid) discoveredLinkedUids.add(d.id); }))
              .catch(() => {})
          );
        }
        if (emailQueries.length > 0) {
          await Promise.all(emailQueries);
        }

        const fallbackEmail =
          cleanAuthEmail ||
          (normFirebasePhone
            ? `${normFirebasePhone.replace(/\+/g, '')}@phone.cloudsend.local`
            : `${user.uid}@cloudsend.local`);
        const fallbackDisplayName =
          user.displayName ||
          (cleanAuthEmail ? cleanAuthEmail.split('@')[0] : '') ||
          (normFirebasePhone ? `${pickAuth('Người dùng', 'User', '用户')} ${normFirebasePhone.slice(-4)}` : '') ||
          pickAuth('Người dùng', 'User', '用户');

        const rawProviderAvatar =
          user.photoURL ||
          user.providerData?.find((p) => Boolean(p?.photoURL))?.photoURL ||
          undefined;

        const appUser: AppUser = {
          uid: user.uid,
          email: user.email || fallbackEmail,
          displayName: fallbackDisplayName,
          photoURL: rawProviderAvatar || null,
          authProvider: detectedAuthProvider,
          linkedEmail: cleanAuthEmail || undefined,
          phone: normFirebasePhone || user.phoneNumber || undefined,
          linkedPhone: normFirebasePhone || user.phoneNumber || undefined,
          linkedUids: Array.from(discoveredLinkedUids),
        };
        setCurrentUser(appUser);
        currentUserRef.current = appUser;
        localStorage.setItem('cloudsend_custom_session', JSON.stringify(appUser));

        try {
          const userDocRef = doc(db, 'users', user.uid);
          let userDocSnap;
          try {
            userDocSnap = await getDoc(userDocRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          }

          let profileData: UserDevice;
          const providerAvatar = rawProviderAvatar;
          const nowIso = new Date().toISOString();
          if (userDocSnap && userDocSnap.exists()) {
            profileData = userDocSnap.data() as UserDevice;
            const mergedUids = Array.from(new Set([
              ...(profileData.linkedUids || []),
              ...Array.from(discoveredLinkedUids),
            ]));
            profileData.linkedUids = mergedUids;
            profileData.authProvider = detectedAuthProvider;
            if (cleanAuthEmail) {
              profileData.linkedEmail = profileData.linkedEmail || cleanAuthEmail;
              profileData.isEmailVerified = profileData.isEmailVerified ?? Boolean(user.emailVerified);
            }
            if (normFirebasePhone) {
              profileData.phone = profileData.phone || normFirebasePhone;
              profileData.linkedPhone = profileData.linkedPhone || normFirebasePhone;
              profileData.phoneNumber = profileData.phoneNumber || user.phoneNumber || normFirebasePhone;
              profileData.isPhoneVerified = true;
            }
            const effectiveAvatar = providerAvatar || profileData.customAvatarUrl || profileData.avatarUrl;
            profileData.customAvatarUrl = effectiveAvatar || undefined;
            profileData.avatarUrl = effectiveAvatar || undefined;
            profileData.photoURL = providerAvatar || profileData.photoURL || undefined;
            const updatePatch: Record<string, any> = {
              authProvider: detectedAuthProvider,
              lastBrowser: detectBrowserInfo(),
              lastSeen: nowIso,
              customAvatarUrl: effectiveAvatar || null,
              avatarUrl: effectiveAvatar || null,
              photoURL: providerAvatar || null,
              linkedUids: mergedUids,
            };
            if (detectedAuthProvider === 'facebook') updatePatch.facebookUid = user.uid;
            if (detectedAuthProvider === 'github') updatePatch.githubUid = user.uid;
            if (detectedAuthProvider === 'google') updatePatch.googleUid = user.uid;
            if (normFirebasePhone) {
              updatePatch.phone = profileData.phone;
              updatePatch.linkedPhone = profileData.linkedPhone;
              updatePatch.phoneNumber = profileData.phoneNumber;
              updatePatch.isPhoneVerified = true;
            }
            setDoc(userDocRef, updatePatch, { merge: true }).catch(() => {});
            if (mergedUids.length > 0) {
              appUser.linkedUids = mergedUids;
              localStorage.setItem('cloudsend_custom_session', JSON.stringify(appUser));
            }
            setSettings((prev) => ({
              ...prev,
              deviceName: profileData.deviceName || prev.deviceName,
              deviceType: detectDeviceType(),
              avatarColor: profileData.avatarColor || prev.avatarColor,
              customAvatarUrl: effectiveAvatar || undefined,
            }));
          } else {
            profileData = {
              uid: user.uid,
              email: user.email || fallbackEmail,
              ...(cleanAuthEmail ? { linkedEmail: cleanAuthEmail, isEmailVerified: Boolean(user.emailVerified) } : {}),
              ...(normFirebasePhone
                ? {
                    phone: normFirebasePhone,
                    linkedPhone: normFirebasePhone,
                    phoneNumber: user.phoneNumber || normFirebasePhone,
                    isPhoneVerified: true,
                  }
                : {}),
              ...(detectedAuthProvider === 'google' ? { googleUid: user.uid } : {}),
              ...(detectedAuthProvider === 'facebook' ? { facebookUid: user.uid } : {}),
              ...(detectedAuthProvider === 'github' ? { githubUid: user.uid } : {}),
              authProvider: detectedAuthProvider,
              lastBrowser: detectBrowserInfo(),
              linkedUids: Array.from(discoveredLinkedUids),
              displayName: fallbackDisplayName,
              deviceName: settings.deviceName,
              deviceType: detectDeviceType(),
              avatarColor: settings.avatarColor,
              customAvatarUrl: providerAvatar,
              avatarUrl: providerAvatar,
              photoURL: providerAvatar,
              createdAt: nowIso,
              lastSeen: nowIso,
            };
            try {
              await setDoc(userDocRef, profileData);
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
            }
            if (providerAvatar) {
              setSettings((prev) => ({ ...prev, customAvatarUrl: providerAvatar }));
            }
          }

          setUserProfile(profileData);
          await updatePresence(user.uid, profileData);
        } catch (error) {
          console.error('Error fetching user profile:', error);
          await updatePresence(user.uid);
        }
      } else {
        // No Firebase Auth user, restore custom session from localStorage
        await restoreCustomSession();
      }

      if (isMounted) {
        setLoading(false);
      }
    });

    // Presence Heartbeat loop: ping every 15s to keep presence fresh within the 3-minute (180,000ms) lifetime window
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = setInterval(() => {
      if (currentUserRef.current) {
        updatePresence(currentUserRef.current.uid);
      }
    }, 15000);

    const handleVisibilityChange = () => {
      if (currentUserRef.current && typeof document !== 'undefined' && !document.hidden) {
        updatePresence(currentUserRef.current.uid);
      }
    };
    const handleFocus = () => {
      if (currentUserRef.current) {
        updatePresence(currentUserRef.current.uid);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Lưu ý: Chuẩn Facebook giữ thời gian sống 3 phút (180.000ms).
    // Không xóa presence tức thì khi tải lại trang / chuyển tab để duy trì trạng thái online 3 phút
    // Chỉ khi quá 3 phút không có heartbeat/phản hồi từ client thì các máy khác mới coi là offline.

    return () => {
      isMounted = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    };
  }, []);

  const loginWithFirebaseProvider = async (
    provider: FirebaseAuthProvider,
    providerLabel: string
  ) => {
    isExplicitGoogleLoginRef.current = true;
    try {
      const res = await signInWithPopup(auth, provider);
      if (res.user) {
        const normPhone = normalizePhoneNumber(res.user.phoneNumber);
        const banCheck = await checkUserBanStatus(res.user.email, res.user.uid, {
          phone: normPhone || null,
          linkedEmail: res.user.email || null,
        });
        if (banCheck.isBanned) {
          await signOut(auth);
          throw new Error(banCheck.message || pickAuth('Tài khoản của bạn đã bị DEV cấm tham gia hệ thống.', 'Your account has been banned by DEV from using the system.', '您的账号已被 DEV 禁止使用本系统。'));
        }

        let photoUrl =
          res.user.photoURL ||
          res.user.providerData?.find((p) => Boolean(p?.photoURL))?.photoURL ||
          '';

        // For Facebook login, resolve a crisp public CDN avatar URL via Graph API using the OAuth token
        if (providerLabel === 'Facebook') {
          try {
            const fbCred = FacebookAuthProvider.credentialFromResult(res);
            if (fbCred?.accessToken) {
              const picResp = await fetch(
                `https://graph.facebook.com/me/picture?type=large&width=512&height=512&redirect=false&access_token=${encodeURIComponent(
                  fbCred.accessToken
                )}`
              );
              if (picResp.ok) {
                const picJson = await picResp.json();
                if (picJson?.data?.url) {
                  photoUrl = String(picJson.data.url);
                }
              }
            }
          } catch {}
        }

        if (photoUrl) {
          setSettings((prev) => ({ ...prev, customAvatarUrl: photoUrl }));
          if (currentUserRef.current) {
            currentUserRef.current.photoURL = photoUrl;
          }
          try {
            await setDoc(
              doc(db, 'users', res.user.uid),
              {
                customAvatarUrl: photoUrl,
                avatarUrl: photoUrl,
                photoURL: photoUrl,
              },
              { merge: true }
            );
          } catch {}
          await updatePresence(res.user.uid, { customAvatarUrl: photoUrl }).catch(() => {});
        }
      }
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        console.info(`${providerLabel} Sign-In popup was closed by user.`);
        throw error;
      }
      if (error?.code === 'auth/popup-blocked') {
        console.warn(`${providerLabel} popup blocked, falling back to signInWithRedirect...`);
        await signInWithRedirect(auth, provider);
        return;
      }
      if (error?.code === 'auth/account-exists-with-different-credential') {
        const pendingCred =
          FacebookAuthProvider.credentialFromError(error) ||
          GithubAuthProvider.credentialFromError(error) ||
          OAuthProvider.credentialFromError(error);
        const conflictEmail = (error?.customData?.email as string) || '';
        let suggestedProvider: 'google' | 'github' | 'facebook' | null =
          providerLabel === 'Google' ? 'facebook' : 'google';
        if (conflictEmail) {
          try {
            const methods = await fetchSignInMethodsForEmail(auth, conflictEmail);
            if (methods.includes('google.com')) suggestedProvider = 'google';
            else if (methods.includes('github.com')) suggestedProvider = 'github';
            else if (methods.includes('facebook.com')) suggestedProvider = 'facebook';
          } catch {}
        }
        if (pendingCred) {
          pendingCredentialRef.current = {
            credential: pendingCred,
            email: conflictEmail,
            providerLabel,
          };
          setPendingCredentialLink({
            email: conflictEmail,
            providerLabel,
            suggestedProvider,
          });
        }
      }
      console.warn(`${providerLabel} Sign-In notice:`, error?.message || error);
      throw error;
    } finally {
      setTimeout(() => {
        isExplicitGoogleLoginRef.current = false;
      }, 1500);
    }
  };

  const clearPendingCredentialLink = () => {
    pendingCredentialRef.current = null;
    setPendingCredentialLink(null);
  };

  const confirmPendingCredentialLink = async (existingProvider: 'google' | 'facebook' | 'github') => {
    const pending = pendingCredentialRef.current;
    const targetProvider =
      existingProvider === 'google'
        ? googleProvider
        : existingProvider === 'facebook'
        ? facebookProvider
        : githubProvider;

    isExplicitGoogleLoginRef.current = true;
    try {
      const res = await signInWithPopup(auth, targetProvider);
      if (res.user && pending?.credential) {
        try {
          await linkWithCredential(res.user, pending.credential);
        } catch (linkErr: any) {
          if (linkErr?.code !== 'auth/provider-already-linked') {
            throw linkErr;
          }
        }
        try {
          const providerPatch: Record<string, any> = {};
          if (pending.providerLabel === 'Facebook') providerPatch.facebookUid = res.user.uid;
          if (pending.providerLabel === 'GitHub') providerPatch.githubUid = res.user.uid;
          if (pending.providerLabel === 'Google') providerPatch.googleUid = res.user.uid;
          if (Object.keys(providerPatch).length > 0) {
            await setDoc(doc(db, 'users', res.user.uid), providerPatch, { merge: true }).catch(() => {});
          }
        } catch {}
      }
      clearPendingCredentialLink();
    } finally {
      setTimeout(() => {
        isExplicitGoogleLoginRef.current = false;
      }, 1500);
    }
  };

  const loginWithGoogle = async () => {
    return loginWithFirebaseProvider(googleProvider, 'Google');
  };

  const loginWithFacebook = async () => {
    return loginWithFirebaseProvider(facebookProvider, 'Facebook');
  };

  const loginWithGithub = async () => {
    return loginWithFirebaseProvider(githubProvider, 'GitHub');
  };

  const resetPhoneLoginState = () => {
    phoneConfirmationRef.current = null;
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {}
      recaptchaVerifierRef.current = null;
    }
  };

  const sendPhoneLoginOtp = async (phoneNumber: string, recaptchaContainerId: string) => {
    const normPhone = normalizePhoneNumber(phoneNumber);
    if (!normPhone || !normPhone.startsWith('+')) {
      throw new Error(
        pickAuth(
          'Số điện thoại phải kèm mã quốc gia (ví dụ: 0912345678 hoặc +84912345678).',
          'Phone number must include a valid country code (e.g. +84912345678 or +15551234567).',
          '手机号码须包含国家区号（例如 +84912345678 或 +8613800138000）。'
        )
      );
    }

    const banCheck = await checkUserBanStatus(null, null, { phone: normPhone });
    if (banCheck.isBanned) {
      throw new Error(
        banCheck.message ||
          pickAuth(
            'Số điện thoại này đang bị DEV cấm tham gia hệ thống.',
            'This phone number has been banned by DEV from accessing the system.',
            '此手机号已被 DEV 禁止登录本系统。'
          )
      );
    }

    // Clear any stale verifier before rendering a fresh one
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {}
      recaptchaVerifierRef.current = null;
    }
    const containerEl = typeof document !== 'undefined' ? document.getElementById(recaptchaContainerId) : null;
    if (!containerEl) {
      throw new Error(pickAuth('Không tìm thấy khung xác thực reCAPTCHA.', 'reCAPTCHA container element not found.', '未找到 reCAPTCHA 验证容器。'));
    }
    containerEl.innerHTML = '';

    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible',
    });
    recaptchaVerifierRef.current = verifier;

    try {
      const confirmationResult = await signInWithPhoneNumber(auth, normPhone, verifier);
      phoneConfirmationRef.current = confirmationResult;
    } catch (err) {
      try {
        verifier.clear();
      } catch {}
      recaptchaVerifierRef.current = null;
      throw err;
    }
  };

  const confirmPhoneLoginOtp = async (otpCode: string) => {
    const cleanOtp = otpCode.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      throw new Error(pickAuth('Mã OTP phải gồm đúng 6 chữ số.', 'OTP code must be exactly 6 digits.', 'OTP 验证码必须为 6 位数字。'));
    }
    if (!phoneConfirmationRef.current) {
      throw new Error(pickAuth('Phiên OTP đã hết hạn. Vui lòng gửi lại mã mới.', 'OTP session expired. Please request a new code.', 'OTP 会话已过期，请重新获取验证码。'));
    }

    isExplicitGoogleLoginRef.current = true;
    try {
      const cred = await phoneConfirmationRef.current.confirm(cleanOtp);
      if (cred.user) {
        const normPhone = normalizePhoneNumber(cred.user.phoneNumber);
        const banCheck = await checkUserBanStatus(cred.user.email, cred.user.uid, {
          phone: normPhone || null,
        });
        if (banCheck.isBanned) {
          await signOut(auth);
          throw new Error(banCheck.message || pickAuth('Số điện thoại / tài khoản này đã bị DEV cấm.', 'This phone number / account has been banned by DEV.', '此手机号 / 账号已被 DEV 封禁。'));
        }
      }
      resetPhoneLoginState();
    } finally {
      setTimeout(() => {
        isExplicitGoogleLoginRef.current = false;
      }, 1500);
    }
  };

  const loginWithAccount = async (usernameOrEmail: string, pass: string) => {
    const cleanIdentifier = usernameOrEmail.trim();
    if (!cleanIdentifier) {
      throw new Error(pickAuth('Vui lòng nhập tên tài khoản.', 'Please enter your username.', '请输入用户名。'));
    }
    if (!pass) {
      throw new Error(pickAuth('Vui lòng nhập mật khẩu tài khoản.', 'Please enter your account password.', '请输入账号密码。'));
    }

    const normalized = cleanIdentifier.toLowerCase();
    const normPhone = normalizePhoneNumber(cleanIdentifier);

    // Check ban status by identifier (email or phone) first
    const banCheck = await checkUserBanStatus(normalized.includes('@') ? normalized : null, null, {
      phone: normPhone || null,
    });
    if (banCheck.isBanned) {
      throw new Error(banCheck.message || pickAuth('Tài khoản này đã bị DEV cấm đăng nhập.', 'This account has been banned by DEV.', '此账号已被 DEV 禁止登录。'));
    }

    const accountKey = await getAccountKey(normalized);
    const accountRef = doc(db, 'accounts', accountKey);
    let accountSnap: any = await getDoc(accountRef);

    // Fallback lookup by linkedEmail or email if user logs in using their linked Gmail/email
    if (!accountSnap.exists() && normalized.includes('@')) {
      try {
        const [byLinkedEmail, byEmail] = await Promise.all([
          getDocs(query(collection(db, 'accounts'), where('linkedEmail', '==', normalized))),
          getDocs(query(collection(db, 'accounts'), where('email', '==', normalized))),
        ]);
        if (!byLinkedEmail.empty) {
          accountSnap = byLinkedEmail.docs[0];
        } else if (!byEmail.empty) {
          accountSnap = byEmail.docs[0];
        }
      } catch {}
    }

    // Fallback lookup by normalized phone number if user logs in with Phone Number
    if (!accountSnap.exists() && normPhone) {
      try {
        const [byPhone, byLinkedPhone] = await Promise.all([
          getDocs(query(collection(db, 'accounts'), where('phone', '==', normPhone))),
          getDocs(query(collection(db, 'accounts'), where('linkedPhone', '==', normPhone))),
        ]);
        if (!byPhone.empty) {
          accountSnap = byPhone.docs[0];
        } else if (!byLinkedPhone.empty) {
          accountSnap = byLinkedPhone.docs[0];
        }
      } catch {}
    }

    if (!accountSnap.exists()) {
      const err = new Error(pickAuth('Tên tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.', 'Incorrect username or password. Please check and try again.', '用户名或密码不正确，请检查后重试。'));
      (err as any).code = 'auth/user-not-found';
      throw err;
    }

    const account = accountSnap.data() as CustomAuthAccount;

    // Check ban status by UID, linkedEmail, phone, and linkedUids
    const uidBanCheck = await checkUserBanStatus(account.linkedEmail || account.email, account.uid, {
      phone: account.phone || account.linkedPhone || normPhone || null,
      linkedEmail: account.linkedEmail,
      linkedUids: account.linkedUids,
    });
    if (uidBanCheck.isBanned) {
      throw new Error(uidBanCheck.message || pickAuth('Tài khoản này (hoặc Email / SĐT liên kết) đã bị DEV cấm.', 'This account (or its linked Email / Phone) has been banned by DEV.', '此账号（或关联的邮箱/手机号）已被 DEV 封禁。'));
    }

    const computedHash = await hashPassword(pass, account.salt);

    if (computedHash !== account.passwordHash) {
      const err = new Error(pickAuth('Tên tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.', 'Incorrect username or password. Please check and try again.', '用户名或密码不正确，请检查后重试。'));
      (err as any).code = 'auth/wrong-password';
      throw err;
    }

    // Sign out any lingering Firebase Google session on this Chrome profile so it can never hijack this ClSend account
    if (auth.currentUser) {
      isSuppressingAuthListenerRef.current = true;
      try {
        await signOut(auth);
      } catch {
      } finally {
        setTimeout(() => {
          isSuppressingAuthListenerRef.current = false;
        }, 1000);
      }
    }

    // Load or generate user profile
    let profileData: UserDevice;
    try {
      const userDocSnap = await getDoc(doc(db, 'users', account.uid));
      if (userDocSnap.exists()) {
        profileData = userDocSnap.data() as UserDevice;
      } else {
        profileData = {
          uid: account.uid,
          email: account.linkedEmail || account.email || `${account.username || account.displayName}@cloudsend.local`,
          linkedEmail: account.linkedEmail,
          linkedUids: account.linkedUids,
          googleUid: account.googleUid,
          username: account.username || cleanIdentifier,
          dob: account.dob,
          gender: account.gender,
          displayName: account.displayName || cleanIdentifier,
          deviceName: account.deviceName || settings.deviceName,
          deviceType: detectDeviceType(),
          avatarColor: account.avatarColor || settings.avatarColor,
          createdAt: account.createdAt,
        };
        await setDoc(doc(db, 'users', account.uid), profileData);
      }
    } catch {
      profileData = {
        uid: account.uid,
        email: account.linkedEmail || account.email || `${account.username || account.displayName}@cloudsend.local`,
        linkedEmail: account.linkedEmail,
        linkedUids: account.linkedUids,
        googleUid: account.googleUid,
        username: account.username || cleanIdentifier,
        dob: account.dob,
        gender: account.gender,
        displayName: account.displayName || cleanIdentifier,
        deviceName: account.deviceName || settings.deviceName,
        deviceType: detectDeviceType(),
        avatarColor: account.avatarColor || settings.avatarColor,
        createdAt: account.createdAt,
      };
    }

    const mergedLinkedUids = Array.from(new Set([
      ...(account.linkedUids || []),
      ...(profileData.linkedUids || []),
      ...(account.googleUid ? [account.googleUid] : []),
      ...(profileData.googleUid ? [profileData.googleUid] : []),
    ].filter((u) => u && u !== account.uid)));

    const effectiveEmail = profileData.linkedEmail || account.linkedEmail || profileData.email || account.email || `${account.username || account.displayName}@cloudsend.local`;
    const effectivePhone = profileData.phone || profileData.linkedPhone || account.phone || account.linkedPhone || null;

    // Authenticated successfully!
    const userSession: AppUser = {
      uid: account.uid,
      email: effectiveEmail,
      linkedEmail: profileData.linkedEmail || account.linkedEmail || null,
      phone: effectivePhone,
      linkedPhone: profileData.linkedPhone || account.linkedPhone || effectivePhone,
      linkedUids: mergedLinkedUids,
      displayName: profileData.displayName || account.displayName || account.username || cleanIdentifier,
      photoURL: profileData.customAvatarUrl || profileData.avatarUrl || profileData.photoURL || null,
      authProvider: 'account',
    };

    localStorage.setItem('cloudsend_custom_session', JSON.stringify(userSession));
    localStorage.setItem('cloudsend_user_profile', JSON.stringify(profileData));
    setCurrentUser(userSession);
    currentUserRef.current = userSession;
    setUserProfile(profileData);
    if (profileData.deviceName) {
      setSettings((prev) => ({
        ...prev,
        deviceName: profileData.deviceName,
        deviceType: detectDeviceType(),
        customAvatarUrl: profileData.customAvatarUrl || prev.customAvatarUrl,
        avatarColor: profileData.avatarColor || prev.avatarColor,
      }));
    }
    try {
      await setDoc(doc(db, 'users', account.uid), {
        authProvider: 'account',
        lastBrowser: detectBrowserInfo(),
        lastSeen: new Date().toISOString(),
      }, { merge: true });
    } catch {}
    await updatePresence(account.uid, profileData);
  };

  const loginWithEmail = async (emailOrUsername: string, pass: string) => {
    return loginWithAccount(emailOrUsername, pass);
  };

  const loginWithSyncPayload = async (payload: { userSession: AppUser; profileData: UserDevice; settings?: Partial<AppSettings> }) => {
    if (!payload?.userSession?.uid) return;
    const syncBanCheck = await checkUserBanStatus(payload.userSession.email, payload.userSession.uid, {
      phone: payload.profileData?.phone || payload.profileData?.linkedPhone || payload.userSession.phone,
      linkedEmail: payload.profileData?.linkedEmail || payload.userSession.linkedEmail,
      linkedUids: payload.profileData?.linkedUids || payload.userSession.linkedUids,
    });
    if (syncBanCheck.isBanned) {
      throw new Error(syncBanCheck.message || pickAuth('Tài khoản này (hoặc Email / SĐT liên kết) đã bị DEV cấm.', 'This account (or its linked Email / Phone) has been banned by DEV.', '此账号（或关联的邮箱/手机号）已被 DEV 封禁。'));
    }
    if (auth.currentUser) {
      isSuppressingAuthListenerRef.current = true;
      try {
        await signOut(auth);
      } catch {
      } finally {
        setTimeout(() => {
          isSuppressingAuthListenerRef.current = false;
        }, 1000);
      }
    }

    const session: AppUser = {
      ...payload.userSession,
      authProvider: payload.userSession.authProvider || 'sync',
    };
    const profile = payload.profileData;

    localStorage.setItem('cloudsend_custom_session', JSON.stringify(session));
    localStorage.setItem('cloudsend_user_profile', JSON.stringify(profile));

    setCurrentUser(session);
    currentUserRef.current = session;
    setUserProfile(profile);

    if (payload.settings) {
      setSettings((prev) => ({ ...prev, ...payload.settings }));
    }

    try {
      await setDoc(doc(db, 'users', session.uid), profile, { merge: true });
    } catch {}

    await updatePresence(session.uid, profile);
  };

  const registerWithAccount = async (
    dataOrUsername: string | {
      username: string;
      pass: string;
      email?: string;
      phone?: string;
      dob?: string;
      gender?: 'Nam' | 'Nữ' | 'Không Muốn Trả Lời' | string;
      deviceName?: string;
    },
    passArg?: string,
    extra?: {
      email?: string;
      phone?: string;
      dob?: string;
      gender?: 'Nam' | 'Nữ' | 'Không Muốn Trả Lời' | string;
      deviceName?: string;
    }
  ) => {
    let data: {
      username: string;
      pass: string;
      email?: string;
      phone?: string;
      dob?: string;
      gender?: 'Nam' | 'Nữ' | 'Không Muốn Trả Lời' | string;
      deviceName?: string;
    };

    if (typeof dataOrUsername === 'string') {
      data = {
        username: dataOrUsername,
        pass: passArg || '',
        email: extra?.email,
        phone: extra?.phone,
        dob: extra?.dob,
        gender: extra?.gender,
        deviceName: extra?.deviceName,
      };
    } else {
      data = dataOrUsername || { username: '', pass: '' };
    }

    const cleanUsername = (data.username || '').trim();
    if (!cleanUsername) {
      throw new Error(pickAuth('Vui lòng nhập tên tài khoản.', 'Please enter your username.', '请输入用户名。'));
    }
    if (!data.pass || data.pass.length < 6) {
      throw new Error(pickAuth('Mật khẩu phải có ít nhất 6 ký tự.', 'Password must be at least 6 characters.', '密码至少需要 6 个字符。'));
    }

    const normalizedUsername = cleanUsername.toLowerCase();
    const cleanInputEmail = (data.email || '').trim().toLowerCase();
    const hasProvidedRealEmail = Boolean(cleanInputEmail && isRealEmail(cleanInputEmail));
    if (cleanInputEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanInputEmail)) {
      throw new Error(pickAuth('Địa chỉ Email không hợp lệ. Vui lòng kiểm tra lại.', 'Invalid Email address. Please check again.', '电子邮箱地址无效，请检查。'));
    }

    const rawPhone = (data.phone || '').trim();
    const normPhone = normalizePhoneNumber(rawPhone);
    if (rawPhone && !normPhone) {
      throw new Error(pickAuth('Số điện thoại không hợp lệ (tối thiểu 7 chữ số).', 'Invalid phone number (minimum 7 digits).', '电话号码无效（至少需要 7 位数字）。'));
    }

    // Ban gate: Block if provided email or phone number belongs to a banned account (never bans clean new accounts/devices!)
    if (hasProvidedRealEmail || normPhone) {
      const contactBanCheck = await checkUserBanStatus(hasProvidedRealEmail ? cleanInputEmail : null, null, {
        phone: normPhone || null,
        linkedEmail: hasProvidedRealEmail ? cleanInputEmail : null,
      });
      if (contactBanCheck.isBanned) {
        throw new Error(
          contactBanCheck.message ||
            pickAuth(
              'Email hoặc Số điện thoại này đang gắn với một tài khoản bị CẤM. Hệ thống chặn đăng ký để chống lách luật.',
              'This Email or Phone number is linked to a BANNED account. Registration is blocked.',
              '此邮箱或手机号已关联到一个被封禁的账号，系统已阻止注册。'
            )
        );
      }
    }

    const devName = data.deviceName?.trim() || settings.deviceName;
    const accountKey = await getAccountKey(normalizedUsername);
    const accountRef = doc(db, 'accounts', accountKey);
    const accountSnap = await getDoc(accountRef);

    if (accountSnap.exists()) {
      const err = new Error(pickAuth(
        'Tên tài khoản này đã được sử dụng. Vui lòng chọn tên khác hoặc chuyển sang Đăng nhập.',
        'This username is already taken. Please choose another or switch to Sign In.',
        '此用户名已被使用，请选择其他用户名或切换至登录。'
      ));
      (err as any).code = 'auth/email-already-in-use';
      throw err;
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(data.pass, salt);
    const uid = generateUid();
    const emailEquivalent = hasProvidedRealEmail
      ? cleanInputEmail
      : `${normalizedUsername.replace(/\s+/g, '_')}@cloudsend.local`;

    const newAccount: CustomAuthAccount = {
      uid,
      email: emailEquivalent,
      ...(hasProvidedRealEmail ? { linkedEmail: cleanInputEmail } : {}),
      ...(normPhone ? { phone: normPhone, linkedPhone: normPhone } : {}),
      username: cleanUsername,
      dob: data.dob?.trim() || undefined,
      gender: data.gender || 'Không Muốn Trả Lời',
      passwordHash,
      salt,
      displayName: cleanUsername,
      deviceName: devName,
      deviceType: settings.deviceType,
      avatarColor: settings.avatarColor,
      createdAt: new Date().toISOString(),
    };

    await setDoc(accountRef, newAccount);

    const newProfile: UserDevice = {
      uid,
      email: emailEquivalent,
      ...(hasProvidedRealEmail ? { linkedEmail: cleanInputEmail } : {}),
      ...(normPhone ? { phone: normPhone, linkedPhone: normPhone } : {}),
      username: cleanUsername,
      dob: data.dob?.trim() || undefined,
      gender: data.gender || 'Không Muốn Trả Lời',
      authProvider: 'account',
      lastBrowser: detectBrowserInfo(),
      displayName: cleanUsername,
      deviceName: devName,
      deviceType: settings.deviceType,
      avatarColor: settings.avatarColor,
      createdAt: newAccount.createdAt,
      lastSeen: newAccount.createdAt,
    };

    await setDoc(doc(db, 'users', uid), newProfile);

    if (auth.currentUser) {
      isSuppressingAuthListenerRef.current = true;
      try {
        await signOut(auth);
      } catch {
      } finally {
        setTimeout(() => {
          isSuppressingAuthListenerRef.current = false;
        }, 1000);
      }
    }

    const userSession: AppUser = {
      uid,
      email: emailEquivalent,
      linkedEmail: hasProvidedRealEmail ? cleanInputEmail : null,
      phone: normPhone || null,
      linkedPhone: normPhone || null,
      displayName: cleanUsername,
      authProvider: 'account',
    };

    localStorage.setItem('cloudsend_custom_session', JSON.stringify(userSession));
    localStorage.setItem('cloudsend_user_profile', JSON.stringify(newProfile));
    setCurrentUser(userSession);
    currentUserRef.current = userSession;
    setUserProfile(newProfile);
    setSettings((prev) => ({ ...prev, deviceName: devName }));
    await updatePresence(uid, newProfile);
  };

  const registerWithEmail = async (email: string, pass: string, name: string, customDeviceName?: string) => {
    return registerWithAccount({
      username: name || email,
      pass,
      deviceName: customDeviceName,
    });
  };

  const loginAsGuest = async (customDisplayName?: string, customDeviceName?: string) => {
    if (auth.currentUser) {
      isSuppressingAuthListenerRef.current = true;
      try {
        await signOut(auth);
      } catch {
      } finally {
        setTimeout(() => {
          isSuppressingAuthListenerRef.current = false;
        }, 1000);
      }
    }

    // Reuse existing guest UID if already created on this browser to avoid ghost duplicate devices
    let uid = typeof window !== 'undefined' ? localStorage.getItem('cloudsend_guest_uid') : null;
    if (!uid) {
      uid = 'guest_' + generateUid();
      if (typeof window !== 'undefined') {
        localStorage.setItem('cloudsend_guest_uid', uid);
      }
    }

    const devName = customDeviceName?.trim() || settings.deviceName;
    const dispName = customDisplayName?.trim() || devName || `${pickAuth('Khách', 'Guest', '访客')} ${Math.floor(1000 + Math.random() * 9000)}`;
    const guestUser: AppUser = {
      uid,
      email: `${uid}@cloudsend.local`,
      displayName: dispName,
      authProvider: 'guest',
    };

    localStorage.setItem('cloudsend_custom_session', JSON.stringify(guestUser));
    setCurrentUser(guestUser);
    currentUserRef.current = guestUser;

    const profileData: UserDevice = {
      uid,
      email: guestUser.email || '',
      authProvider: 'guest',
      lastBrowser: detectBrowserInfo(),
      displayName: dispName,
      deviceName: devName,
      deviceType: settings.deviceType,
      avatarColor: settings.avatarColor || getRandomColor(),
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };

    setUserProfile(profileData);
    localStorage.setItem('cloudsend_user_profile', JSON.stringify(profileData));
    setSettings((prev) => ({ ...prev, deviceName: devName }));

    // Persist to users collection in Firestore so guest accounts are first-class peers
    try {
      await setDoc(doc(db, 'users', uid), profileData, { merge: true });
    } catch (e) {
      console.warn('Could not save guest profile to firestore:', e);
    }

    // Clean up any stale presence records for this physical device from earlier sessions
    const deviceId = getClientDeviceId();
    try {
      const presenceKey = `${uid}_${deviceId}`;
      const snap = await getDocs(query(collection(db, 'presence'), where('deviceId', '==', deviceId)));
      for (const d of snap.docs) {
        if (d.id !== presenceKey) {
          deleteDoc(d.ref).catch(() => {});
        }
      }
    } catch {}

    await updatePresence(uid, profileData);
  };

  const getOrCreateSessionId = (): string => {
    if (typeof window === 'undefined') return 'sess_server';
    let sid = localStorage.getItem('cloudsend_session_id');
    if (!sid) {
      sid = 'sess_' + generateUid();
      localStorage.setItem('cloudsend_session_id', sid);
      localStorage.setItem('cloudsend_session_time', new Date().toISOString());
    }
    return sid;
  };

  const recordLoginSession = async (uid: string, customSettings?: AppSettings) => {
    try {
      const sid = getOrCreateSessionId();
      const currentSet = customSettings || settingsRef.current;
      const browserInfo = detectBrowserInfo();
      const locInfo = detectLocationInfo();
      const sessionRef = doc(db, 'sessions', sid);
      const sessionData: LoginSession = {
        id: sid,
        uid,
        deviceName: currentSet.deviceName || pickAuth('Thiết bị', 'Device', '设备'),
        deviceType: currentSet.deviceType || (isSmartTv() ? 'tv' : detectDeviceType()),
        browser: browserInfo,
        location: locInfo,
        loginAt: localStorage.getItem('cloudsend_session_time') || new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      await setDoc(sessionRef, sessionData, { merge: true });
      await setDoc(doc(db, 'users', uid), {
        lastBrowser: browserInfo,
        lastLocation: locInfo,
        lastActive: sessionData.lastActive,
      }, { merge: true }).catch(() => {});
    } catch (err) {
      console.warn('Could not record login session:', err);
    }
  };

  // Listen to remote Logout All Trigger
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    // Announce session
    recordLoginSession(currentUser.uid);

    const sessionLoginTime = localStorage.getItem('cloudsend_session_time') || new Date().toISOString();
    if (!localStorage.getItem('cloudsend_session_time')) {
      localStorage.setItem('cloudsend_session_time', sessionLoginTime);
    }

    const unsubUser = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.logoutAllTimestamp) {
          const logoutTime = new Date(data.logoutAllTimestamp).getTime();
          const myTime = new Date(sessionLoginTime).getTime();
          // If a global logout all was issued after this session was created
          if (logoutTime >= myTime) {
            logout();
          }
        }
      }
    }, (err) => {
      console.warn('User session listener notice:', err);
    });

    return () => unsubUser();
  }, [currentUser?.uid]);

  const logout = async () => {
    const currentUid = currentUserRef.current?.uid;
    const sid = typeof window !== 'undefined' ? localStorage.getItem('cloudsend_session_id') : null;
    
    if (sid) {
      try {
        await deleteDoc(doc(db, 'sessions', sid));
      } catch {
        // ignore
      }
      localStorage.removeItem('cloudsend_session_id');
      localStorage.removeItem('cloudsend_session_time');
    }

    if (currentUid) {
      await removePresence(currentUid);
    }
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
    localStorage.removeItem('cloudsend_custom_session');
    localStorage.removeItem('cloudsend_user_profile');
    if (auth.currentUser) {
      await signOut(auth);
    }
    setCurrentUser(null);
    currentUserRef.current = null;
    setUserProfile(null);
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!currentUserRef.current) {
      throw new Error(pickAuth('Vui lòng đăng nhập để đổi mật khẩu.', 'Please sign in to change your password.', '请先登录再修改密码。'));
    }
    if (!currentPass) {
      throw new Error(pickAuth('Vui lòng nhập mật khẩu hiện tại.', 'Please enter your current password.', '请输入当前密码。'));
    }
    if (!newPass || newPass.length < 6) {
      throw new Error(pickAuth('Mật khẩu mới phải có ít nhất 6 ký tự.', 'New password must be at least 6 characters.', '新密码至少需要 6 个字符。'));
    }

    const usr = currentUserRef.current;
    const prof = userProfile;
    const identifier = prof?.username || usr.displayName || usr.email || '';
    const cleanId = identifier.trim().toLowerCase();

    const accountKey = await getAccountKey(cleanId);
    const accountRef = doc(db, 'accounts', accountKey);
    let accountSnap = await getDoc(accountRef);

    // If not found by identifier, search by email if different
    if (!accountSnap.exists() && usr.email) {
      const emailKey = await getAccountKey(usr.email.trim().toLowerCase());
      const emailSnap = await getDoc(doc(db, 'accounts', emailKey));
      if (emailSnap.exists()) {
        accountSnap = emailSnap;
      }
    }

    if (!accountSnap.exists()) {
      throw new Error(pickAuth(
        'Không tìm thấy bản ghi tài khoản để cập nhật mật khẩu. Nếu bạn dùng Google, vui lòng đăng nhập bằng Google.',
        'Account record not found to update password. If you use Google, please sign in with Google.',
        '未找到可更新密码的账号记录。如果您使用 Google 账号，请通过 Google 登录。'
      ));
    }

    const account = accountSnap.data() as CustomAuthAccount;
    const computedCurrentHash = await hashPassword(currentPass, account.salt);
    if (computedCurrentHash !== account.passwordHash) {
      throw new Error(pickAuth('Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại.', 'Current password is incorrect. Please check again.', '当前密码不正确，请检查。'));
    }

    // Generate fresh salt and new hash
    const newSalt = generateSalt();
    const newPasswordHash = await hashPassword(newPass, newSalt);

    await setDoc(accountSnap.ref, {
      passwordHash: newPasswordHash,
      salt: newSalt,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const updateDisplayName = async (newDisplayName: string) => {
    const cleanName = newDisplayName.trim();
    if (!cleanName) {
      throw new Error(pickAuth('Tên hiển thị không được để trống.', 'Display name cannot be empty.', '显示名称不能为空。'));
    }
    if (cleanName.length < 2) {
      throw new Error(pickAuth('Tên hiển thị phải có ít nhất 2 ký tự.', 'Display name must be at least 2 characters.', '显示名称至少需要 2 个字符。'));
    }

    const currentUsr = currentUserRef.current;
    if (!currentUsr) {
      throw new Error(pickAuth('Chưa đăng nhập.', 'Not signed in.', '尚未登录。'));
    }

    const updatedUser: AppUser = {
      ...currentUsr,
      displayName: cleanName,
    };
    setCurrentUser(updatedUser);
    currentUserRef.current = updatedUser;
    localStorage.setItem('cloudsend_custom_session', JSON.stringify(updatedUser));

    setSettings((prev) => ({
      ...prev,
      deviceName: cleanName,
    }));

    const updatedProfile: UserDevice = {
      ...(userProfile || {
        uid: currentUsr.uid,
        email: currentUsr.email || '',
        displayName: cleanName,
        deviceName: cleanName,
        deviceType: settings.deviceType,
        avatarColor: settings.avatarColor || '#10B981',
        createdAt: new Date().toISOString(),
      }),
      displayName: cleanName,
      deviceName: cleanName,
    };
    setUserProfile(updatedProfile);
    localStorage.setItem('cloudsend_user_profile', JSON.stringify(updatedProfile));

    try {
      await setDoc(doc(db, 'users', currentUsr.uid), { 
        displayName: cleanName,
        deviceName: cleanName
      }, { merge: true });
      await updatePresence(currentUsr.uid, updatedProfile);

      // Also update account doc if custom account
      const identifier = userProfile?.username || currentUsr.displayName || currentUsr.email || '';
      if (identifier) {
        const accountKey = await getAccountKey(identifier.trim().toLowerCase());
        await setDoc(doc(db, 'accounts', accountKey), { displayName: cleanName }, { merge: true }).catch(() => {});
      }
    } catch (err) {
      console.error('Error updating display name in firestore:', err);
    }
  };

  const linkEmail = async (newEmail: string) => {
    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error(pickAuth('Địa chỉ email không hợp lệ. Vui lòng nhập đúng định dạng (ví dụ: yourname@gmail.com).', 'Invalid email address. Please enter a valid format (e.g. yourname@gmail.com).', '电子邮箱地址无效，请输入正确格式（例如 yourname@gmail.com）。'));
    }

    const banCheck = await checkUserBanStatus(cleanEmail, null, { linkedEmail: cleanEmail });
    if (banCheck.isBanned) {
      throw new Error(banCheck.message || pickAuth('Email này đang bị CẤM trong hệ thống. Không thể liên kết Email bị cấm!', 'This Email is BANNED in the system. Cannot link a banned email!', '此邮箱已被系统封禁，无法绑定！'));
    }

    const currentUsr = currentUserRef.current;
    if (!currentUsr) {
      throw new Error(pickAuth('Chưa đăng nhập.', 'Not signed in.', '尚未登录。'));
    }

    const updatedUser: AppUser = {
      ...currentUsr,
      email: cleanEmail,
      linkedEmail: cleanEmail,
    };
    setCurrentUser(updatedUser);
    currentUserRef.current = updatedUser;
    localStorage.setItem('cloudsend_custom_session', JSON.stringify(updatedUser));

    const updatedProfile: UserDevice = {
      ...(userProfile || {
        uid: currentUsr.uid,
        displayName: currentUsr.displayName || pickAuth('Người dùng', 'User', '用户'),
        deviceName: settings.deviceName,
        deviceType: settings.deviceType,
        avatarColor: settings.avatarColor || '#10B981',
        createdAt: new Date().toISOString(),
      }),
      email: cleanEmail,
      linkedEmail: cleanEmail,
    };
    setUserProfile(updatedProfile);
    localStorage.setItem('cloudsend_user_profile', JSON.stringify(updatedProfile));

    try {
      await setDoc(doc(db, 'users', currentUsr.uid), { email: cleanEmail, linkedEmail: cleanEmail }, { merge: true });
      
      const identifier = userProfile?.username || currentUsr.displayName || '';
      if (identifier) {
        const accountKey = await getAccountKey(identifier.trim().toLowerCase());
        await setDoc(doc(db, 'accounts', accountKey), { email: cleanEmail, linkedEmail: cleanEmail }, { merge: true }).catch(() => {});
      }
    } catch (err) {
      console.error('Error linking email:', err);
      throw err;
    }
  };

  const linkPhoneNumber = async (newPhone: string): Promise<string> => {
    const normPhone = normalizePhoneNumber(newPhone);
    if (!normPhone) {
      throw new Error(pickAuth('Số điện thoại không hợp lệ. Vui lòng nhập ít nhất 7 chữ số.', 'Invalid phone number. Please enter at least 7 digits.', '电话号码无效，请至少输入 7 位数字。'));
    }

    const banCheck = await checkUserBanStatus(null, null, { phone: normPhone });
    if (banCheck.isBanned) {
      throw new Error(banCheck.message || pickAuth('Số điện thoại này đang gắn với tài khoản bị CẤM. Không thể liên kết!', 'This phone number is linked to a BANNED account. Cannot link!', '此手机号已关联到一个被封禁的账号，无法绑定！'));
    }

    const currentUsr = currentUserRef.current;
    if (!currentUsr) {
      throw new Error(pickAuth('Chưa đăng nhập.', 'Not signed in.', '尚未登录。'));
    }

    const nowIso = new Date().toISOString();
    const updatedUser: AppUser = {
      ...currentUsr,
      phone: normPhone,
      linkedPhone: normPhone,
    };
    setCurrentUser(updatedUser);
    currentUserRef.current = updatedUser;
    localStorage.setItem('cloudsend_custom_session', JSON.stringify(updatedUser));

    const updatedProfile: UserDevice = {
      ...(userProfile || {
        uid: currentUsr.uid,
        email: currentUsr.email || '',
        displayName: currentUsr.displayName || pickAuth('Người dùng', 'User', '用户'),
        deviceName: settings.deviceName,
        deviceType: settings.deviceType,
        avatarColor: settings.avatarColor || '#10B981',
        createdAt: nowIso,
      }),
      phone: normPhone,
      linkedPhone: normPhone,
      phoneNumber: normPhone,
      isPhoneVerified: true,
    };
    setUserProfile(updatedProfile);
    localStorage.setItem('cloudsend_user_profile', JSON.stringify(updatedProfile));

    try {
      await setDoc(doc(db, 'users', currentUsr.uid), {
        phone: normPhone,
        linkedPhone: normPhone,
        phoneNumber: normPhone,
        isPhoneVerified: true,
      }, { merge: true });

      const identifier = userProfile?.username || currentUsr.displayName || '';
      if (identifier) {
        const accountKey = await getAccountKey(identifier.trim().toLowerCase());
        const accSnap = await getDoc(doc(db, 'accounts', accountKey));
        if (accSnap.exists()) {
          await setDoc(accSnap.ref, { phone: normPhone, linkedPhone: normPhone }, { merge: true }).catch(() => {});
        }
      }
      const byUid = await getDocs(query(collection(db, 'accounts'), where('uid', '==', currentUsr.uid)));
      for (const d of byUid.docs) {
        await setDoc(d.ref, { phone: normPhone, linkedPhone: normPhone }, { merge: true }).catch(() => {});
      }
    } catch (err) {
      console.error('Error linking phone:', err);
      throw err;
    }

    return normPhone;
  };

  const sendEmailVerificationCode = async (targetEmail: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error(pickAuth('Địa chỉ email không hợp lệ. Vui lòng nhập đúng định dạng (ví dụ: yourname@gmail.com).', 'Invalid email address. Please enter a valid format (e.g. yourname@gmail.com).', '电子邮箱地址无效，请输入正确格式（例如 yourname@gmail.com）。'));
    }

    const currentUsr = currentUserRef.current;
    if (!currentUsr) {
      throw new Error(pickAuth('Chưa đăng nhập.', 'Not signed in.', '尚未登录。'));
    }

    // Generate secure 6-digit code (e.g. 849201)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const expiresTimestamp = now + 15 * 60 * 1000; // strictly 15 minutes
    const expiresAt = new Date(expiresTimestamp).toISOString();
    const createdAt = new Date(now).toISOString();
    const verificationId = `otp_${currentUsr.uid}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const localeTag = getLocaleTag(getActiveAppLang());
    const formattedTimeSent = new Date(now).toLocaleString(localeTag, {
      hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const formattedTimeExpires = new Date(expiresTimestamp).toLocaleString(localeTag, {
      hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const userLabel = currentUsr.displayName || pickAuth('Người dùng', 'User', '用户');
    const emailMessage = pickAuth(
      'Kính gửi người dùng ClSend,\n\nHệ thống đã tiếp nhận yêu cầu liên kết địa chỉ Email [{email}] với tài khoản của bạn ({user}).\n\nMÃ XÁC THỰC BẢO MẬT 6 CHỮ SỐ CỦA BẠN LÀ:\n\n    >>>  {code}  <<<\n\nTHỜI HẠN VÀ ĐIỀU KHOẢN HIỆU LỰC:\n• Mã số này CHỈ CÓ HIỆU LỰC TRONG VÒNG 15 PHÚT (Từ: {sent} - Hết hạn lúc: {exp}).\n• Khi quá 15 phút, mã sẽ tự động hết hiệu lực.\n• Tuyệt đối không cung cấp mã 6 chữ số này cho bất kỳ ai.\n\nTrân trọng,\nĐội ngũ Bảo mật ClSend Relay Network',
      'Dear ClSend user,\n\nWe received a request to link email [{email}] to your account ({user}).\n\nYOUR 6-DIGIT SECURITY VERIFICATION CODE IS:\n\n    >>>  {code}  <<<\n\nVALIDITY:\n• Valid for 15 minutes only (From: {sent} - Expires: {exp}).\n• Never share this 6-digit code with anyone.\n\nBest regards,\nClSend Relay Network Security Team',
      '尊敬的 ClSend 用户：\n\n系统已收到将邮箱 [{email}] 绑定到您账号 ({user}) 的请求。\n\n您的 6 位安全验证码是：\n\n    >>>  {code}  <<<\n\n有效期说明：\n• 此验证码仅在 15 分钟内有效（发送时间：{sent} - 过期时间：{exp}）。\n• 请勿向任何人泄露此 6 位验证码。\n\n此致，\nClSend 中继网络安全团队'
    )
      .replace('{email}', cleanEmail)
      .replace('{user}', userLabel)
      .replace('{code}', code)
      .replace('{sent}', formattedTimeSent)
      .replace('{exp}', formattedTimeExpires);

    const record: EmailVerificationRecord = {
      id: verificationId,
      uid: currentUsr.uid,
      email: cleanEmail,
      code,
      createdAt,
      expiresAt,
      expiresTimestamp,
      isUsed: false,
    };

    try {
      await setDoc(doc(db, 'email_verifications', verificationId), record);
    } catch (err) {
      console.warn('Error saving OTP to firestore:', err);
    }
    // Also save locally for instant response & offline stability
    localStorage.setItem(`cloudsend_active_otp_${currentUsr.uid}`, JSON.stringify(record));

    // Dispatch real email via backend SMTP server (clsendmailer@gmail.com)
    let serverRespData: any = null;
    try {
      const resp = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          code,
          username: currentUsr.displayName || pickAuth('Người dùng ClSend', 'ClSend User', 'ClSend 用户'),
          durationMinutes: 15
        })
      });
      if (resp.ok) {
        serverRespData = await resp.json();
      }
    } catch (err) {
      console.warn('API send-verification-email call notice:', err);
    }

    return {
      code,
      expiresAt,
      expiresTimestamp,
      emailMessage,
      recipientEmail: cleanEmail,
      isRealSmtp: Boolean(serverRespData?.isRealSmtp),
      serverMessage: serverRespData?.message || null,
    };
  };

  const verifyEmailCodeAndLink = async (targetEmail: string, inputCode: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    const cleanCode = inputCode.trim();

    if (!cleanCode) {
      throw new Error(pickAuth('Vui lòng nhập mã xác nhận 6 chữ số.', 'Please enter the 6-digit verification code.', '请输入 6 位验证码。'));
    }
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      throw new Error(pickAuth('Mã xác nhận phải gồm đúng 6 chữ số.', 'Verification code must be exactly 6 digits.', '验证码必须为 6 位数字。'));
    }

    const currentUsr = currentUserRef.current;
    if (!currentUsr) {
      throw new Error(pickAuth('Chưa đăng nhập.', 'Not signed in.', '尚未登录。'));
    }

    const verificationId = `otp_${currentUsr.uid}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    let record: EmailVerificationRecord | null = null;

    try {
      const snap = await getDoc(doc(db, 'email_verifications', verificationId));
      if (snap.exists()) {
        record = snap.data() as EmailVerificationRecord;
      }
    } catch {
      // fallback to local storage
    }

    if (!record) {
      const local = localStorage.getItem(`cloudsend_active_otp_${currentUsr.uid}`);
      if (local) {
        try {
          record = JSON.parse(local);
        } catch {}
      }
    }

    if (!record || record.email !== cleanEmail) {
      throw new Error(pickAuth('Không tìm thấy yêu cầu xác nhận cho email này. Vui lòng nhấn "Gửi mã xác nhận 6 số" trước.', 'No verification request found for this email. Please send the 6-digit code first.', '未找到此邮箱的验证请求，请先发送 6 位验证码。'));
    }

    // Check expiration: strictly 15 minutes
    const now = Date.now();
    if (now > record.expiresTimestamp) {
      const err = new Error(pickAuth('Mã xác nhận đã hết hạn (chỉ có hiệu lực trong 15 phút). Vui lòng nhấn "Gửi lại mã mới".', 'Verification code has expired (valid for 15 minutes only). Please request a new code.', '验证码已过期（有效期仅 15 分钟），请重新发送新验证码。'));
      (err as any).code = 'OTP_EXPIRED';
      throw err;
    }

    if (record.isUsed) {
      const err = new Error(pickAuth('Mã xác nhận này đã được sử dụng trước đó. Vui lòng gửi lại mã mới.', 'This verification code has already been used. Please request a new code.', '此验证码已被使用，请重新获取新验证码。'));
      (err as any).code = 'OTP_ALREADY_USED';
      throw err;
    }

    if (record.code !== cleanCode) {
      const err = new Error(pickAuth('Mã xác thực 6 số không chính xác. Vui lòng kiểm tra lại.', 'Incorrect 6-digit verification code. Please check again.', '6 位验证码不正确，请检查。'));
      (err as any).code = 'OTP_MISMATCH';
      throw err;
    }

    const banCheck = await checkUserBanStatus(cleanEmail, null, { linkedEmail: cleanEmail });
    if (banCheck.isBanned) {
      throw new Error(banCheck.message || pickAuth('Email này đang bị CẤM trong hệ thống. Không thể liên kết Email bị cấm!', 'This Email is BANNED in the system. Cannot link a banned email!', '此邮箱已被系统封禁，无法绑定！'));
    }

    // Code is valid! Mark as used & Link Email
    try {
      await setDoc(doc(db, 'email_verifications', verificationId), {
        isUsed: true,
        usedAt: new Date().toISOString()
      }, { merge: true });
    } catch {}
    localStorage.removeItem(`cloudsend_active_otp_${currentUsr.uid}`);

    // Update user record & profile (for registered accounts: verify email only, preserve avatar)
    const nowIso = new Date().toISOString();

    const updatedUser: AppUser = {
      ...currentUsr,
      email: cleanEmail,
      linkedEmail: cleanEmail,
    };
    setCurrentUser(updatedUser);
    currentUserRef.current = updatedUser;
    localStorage.setItem('cloudsend_custom_session', JSON.stringify(updatedUser));

    const updatedProfile: UserDevice = {
      ...(userProfile || {
        uid: currentUsr.uid,
        displayName: currentUsr.displayName || pickAuth('Người dùng', 'User', '用户'),
        deviceName: settings.deviceName,
        deviceType: settings.deviceType,
        avatarColor: settings.avatarColor || '#10B981',
        createdAt: nowIso,
      }),
      email: cleanEmail,
      linkedEmail: cleanEmail,
      isEmailVerified: true,
      emailVerifiedAt: nowIso,
    };
    setUserProfile(updatedProfile);
    localStorage.setItem('cloudsend_user_profile', JSON.stringify(updatedProfile));

    try {
      await setDoc(doc(db, 'users', currentUsr.uid), {
        email: cleanEmail,
        linkedEmail: cleanEmail,
        isEmailVerified: true,
        emailVerifiedAt: nowIso,
      }, { merge: true });

      await updatePresence(currentUsr.uid, updatedProfile);

      const identifier = userProfile?.username || currentUsr.displayName || '';
      if (identifier) {
        const accountKey = await getAccountKey(identifier.trim().toLowerCase());
        await setDoc(doc(db, 'accounts', accountKey), {
          email: cleanEmail,
          linkedEmail: cleanEmail,
          isEmailVerified: true,
          emailVerifiedAt: nowIso,
        }, { merge: true }).catch(() => {});
      }
    } catch (err) {
      console.error('Error linking email in firestore:', err);
    }
  };

  const getLoginSessions = async (): Promise<LoginSession[]> => {
    if (!currentUserRef.current) return [];
    const uid = currentUserRef.current.uid;
    const currentSid = typeof window !== 'undefined' ? localStorage.getItem('cloudsend_session_id') : null;

    let accurateLocation = detectLocationInfo();
    try {
      accurateLocation = await fetchSpecificLocation();
    } catch {
      accurateLocation = detectLocationInfo();
    }

    try {
      const q = query(collection(db, 'sessions'), where('uid', '==', uid));
      const snap = await getDocs(q);
      const list: LoginSession[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data() as LoginSession;
        list.push({
          ...data,
          id: docSnap.id,
          isCurrent: docSnap.id === currentSid,
        });
      });

      // If current session is missing in list, construct and add it
      if (currentSid) {
        const currentSession: LoginSession = {
          id: currentSid,
          uid,
          deviceName: settingsRef.current.deviceName || pickAuth('Thiết bị này', 'This device', '当前设备'),
          deviceType: settingsRef.current.deviceType || (isSmartTv() ? 'tv' : detectDeviceType()),
          browser: detectBrowserInfo(),
          location: accurateLocation,
          loginAt: localStorage.getItem('cloudsend_session_time') || new Date().toISOString(),
          lastActive: new Date().toISOString(),
          isCurrent: true,
        };

        const existingIdx = list.findIndex(s => s.id === currentSid);
        if (existingIdx >= 0) {
          list[existingIdx] = {
            ...list[existingIdx],
            ...currentSession,
            browser: detectBrowserInfo(),
            location: accurateLocation,
          };
        } else {
          list.unshift(currentSession);
        }

        // Keep session record fresh in Firestore
        setDoc(doc(db, 'sessions', currentSid), currentSession, { merge: true }).catch(() => {});
      }

      // Sort current device first, then newest lastActive
      list.sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return new Date(b.lastActive || b.loginAt).getTime() - new Date(a.lastActive || a.loginAt).getTime();
      });

      return list;
    } catch (err) {
      console.warn('Error fetching login sessions:', err);
      return [
        {
          id: currentSid || 'sess_current',
          uid,
          deviceName: settingsRef.current.deviceName || pickAuth('Thiết bị này', 'This device', '当前设备'),
          deviceType: settingsRef.current.deviceType || (isSmartTv() ? 'tv' : detectDeviceType()),
          browser: detectBrowserInfo(),
          location: accurateLocation,
          loginAt: localStorage.getItem('cloudsend_session_time') || new Date().toISOString(),
          lastActive: new Date().toISOString(),
          isCurrent: true,
        }
      ];
    }
  };

  const logoutSession = async (sessionId: string) => {
    const currentSid = typeof window !== 'undefined' ? localStorage.getItem('cloudsend_session_id') : null;
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
    } catch (err) {
      console.error('Failed to remove session:', err);
    }
    if (sessionId === currentSid) {
      await logout();
    }
  };

  const logoutAllDevices = async () => {
    const currentUsr = currentUserRef.current;
    if (!currentUsr) return;

    try {
      // 1. Delete all sessions in Firestore for this user
      const q = query(collection(db, 'sessions'), where('uid', '==', currentUsr.uid));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // 2. Write logoutAllTimestamp trigger to users table
      await setDoc(doc(db, 'users', currentUsr.uid), {
        logoutAllTimestamp: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.warn('Error during logout all devices broadcast:', err);
    }

    // 3. Log out current device as well
    await logout();
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    if (newSettings.tvModeEnabled !== undefined) {
      if (newSettings.tvModeEnabled) {
        localStorage.setItem('cloudsend_tv_mode', 'true');
      } else {
        localStorage.removeItem('cloudsend_tv_mode');
      }
    }
    const isTvStored = typeof window !== 'undefined' && localStorage.getItem('cloudsend_tv_mode') === 'true';
    const isTv = isSmartTv() || isTvStored || newSettings.tvModeEnabled === true;
    const effectiveType: DeviceType = isTv ? 'tv' : detectDeviceType();

    setSettings((prev) => {
      const updated = { 
        ...prev, 
        ...newSettings,
        deviceType: effectiveType
      };
      return updated;
    });

    const currentUsr = currentUserRef.current;
    if (currentUsr) {
      const effectiveAvatar = newSettings.customAvatarUrl !== undefined 
        ? newSettings.customAvatarUrl 
        : (settings.customAvatarUrl || userProfile?.customAvatarUrl || currentUsr.photoURL || undefined);

      if (newSettings.customAvatarUrl !== undefined) {
        setCurrentUser((prev) => prev ? ({ ...prev, photoURL: newSettings.customAvatarUrl || null }) : null);
      }

      const cleanUndefined = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;
        const cleaned: any = Array.isArray(obj) ? [] : {};
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          if (val !== undefined) {
            cleaned[key] = (val && typeof val === 'object' && !(val instanceof Date)) ? cleanUndefined(val) : val;
          }
        }
        return cleaned;
      };

      const rawProfile = {
        uid: currentUsr.uid,
        email: currentUsr.email || '',
        displayName: newSettings.deviceName || currentUsr.displayName || currentUsr.email?.split('@')[0] || pickAuth('Người dùng', 'User', '用户'),
        createdAt: userProfile?.createdAt || new Date().toISOString(),
        ...(userProfile || {}),
        deviceName: newSettings.deviceName ?? settings.deviceName,
        deviceType: effectiveType,
        avatarColor: newSettings.avatarColor ?? settings.avatarColor,
        customAvatarUrl: effectiveAvatar || null,
        avatarUrl: effectiveAvatar || null,
        photoURL: effectiveAvatar || null,
        bannerUrl: newSettings.bannerUrl !== undefined ? newSettings.bannerUrl : (userProfile?.bannerUrl || settings.bannerUrl || null),
        customBio: newSettings.customBio !== undefined ? newSettings.customBio : (userProfile?.customBio || settings.customBio || null),
        customBadgeText: newSettings.customBadgeText !== undefined ? newSettings.customBadgeText : (userProfile?.customBadgeText || settings.customBadgeText || null),
        customHexColor: (newSettings.customHexColor ?? userProfile?.customHexColor ?? settings.customHexColor) || null,
      };

      const updatedProfile: UserDevice = cleanUndefined(rawProfile);
      setUserProfile(updatedProfile);
      try {
        await setDoc(doc(db, 'users', currentUsr.uid), updatedProfile, { merge: true });
        await updatePresence(currentUsr.uid, updatedProfile);
      } catch (err) {
        console.error('Failed to sync updated profile to firestore', err);
      }
    }
  };

  const syncGoogleProfilePhoto = async (): Promise<string | null> => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user && res.user.photoURL) {
        const photoUrl = res.user.photoURL;
        const currentUsr = currentUserRef.current;
        if (currentUsr) {
          const updatedUser: AppUser = {
            ...currentUsr,
            photoURL: photoUrl,
          };
          setCurrentUser(updatedUser);
          currentUserRef.current = updatedUser;
          localStorage.setItem('cloudsend_custom_session', JSON.stringify(updatedUser));

          const updatedProf: UserDevice = {
            ...(userProfile || {
              uid: currentUsr.uid,
              displayName: currentUsr.displayName || pickAuth('Người dùng', 'User', '用户'),
              deviceName: settings.deviceName,
              deviceType: settings.deviceType,
              avatarColor: settings.avatarColor || '#10B981',
              createdAt: new Date().toISOString(),
              email: currentUsr.email || '',
            }),
            customAvatarUrl: photoUrl,
            avatarUrl: photoUrl,
            photoURL: photoUrl,
          };
          setUserProfile(updatedProf);
          localStorage.setItem('cloudsend_user_profile', JSON.stringify(updatedProf));

          setSettings((prev) => ({ ...prev, customAvatarUrl: photoUrl }));

          await setDoc(doc(db, 'users', currentUsr.uid), {
            customAvatarUrl: photoUrl,
            avatarUrl: photoUrl,
            photoURL: photoUrl,
          }, { merge: true });

          await updatePresence(currentUsr.uid, updatedProf);
        }
        return photoUrl;
      }
      return null;
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return null;
      }
      console.warn('Sync Google photo error:', err);
      throw err;
    }
  };

  const linkWithGoogleAccount = async (): Promise<{ email: string; photoURL: string | null } | null> => {
    isLinkingAccountRef.current = true;
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        const photoUrl = res.user.photoURL;
        const email = (res.user.email || '').trim().toLowerCase();
        const googleUid = res.user.uid;

        const googleBanCheck = await checkUserBanStatus(email, googleUid, { linkedEmail: email });
        if (googleBanCheck.isBanned) {
          await signOut(auth).catch(() => {});
          throw new Error(googleBanCheck.message || pickAuth('Tài khoản Google / Email này đã bị DEV CẤM. Không thể liên kết!', 'This Google account / Email has been BANNED by DEV. Cannot link!', '此 Google 账号 / 邮箱已被 DEV 封禁，无法关联！'));
        }

        const nowIso = new Date().toISOString();
        const currentUsr = currentUserRef.current;

        if (currentUsr) {
          const mergedLinkedUids = Array.from(new Set([
            ...(currentUsr.linkedUids || []),
            ...(userProfile?.linkedUids || []),
            ...(googleUid && googleUid !== currentUsr.uid ? [googleUid] : []),
          ].filter(Boolean)));

          const updatedUser: AppUser = {
            ...currentUsr,
            email: email || currentUsr.email,
            linkedEmail: email || currentUsr.linkedEmail,
            linkedUids: mergedLinkedUids,
            photoURL: photoUrl || currentUsr.photoURL,
          };
          setCurrentUser(updatedUser);
          currentUserRef.current = updatedUser;
          localStorage.setItem('cloudsend_custom_session', JSON.stringify(updatedUser));

          const updatedProf: UserDevice = {
            ...(userProfile || {
              uid: currentUsr.uid,
              displayName: currentUsr.displayName || pickAuth('Người dùng', 'User', '用户'),
              deviceName: settings.deviceName,
              deviceType: settings.deviceType,
              avatarColor: settings.avatarColor || '#10B981',
              createdAt: nowIso,
            }),
            email: email || currentUsr.email || '',
            linkedEmail: email || currentUsr.email || '',
            linkedUids: mergedLinkedUids,
            googleUid: googleUid || userProfile?.googleUid,
            isEmailVerified: true,
            emailVerifiedAt: nowIso,
            customAvatarUrl: photoUrl || userProfile?.customAvatarUrl,
          };
          setUserProfile(updatedProf);
          localStorage.setItem('cloudsend_user_profile', JSON.stringify(updatedProf));

          if (photoUrl) {
            setSettings((prev) => ({ ...prev, customAvatarUrl: photoUrl }));
          }

          try {
            await setDoc(doc(db, 'users', currentUsr.uid), {
              email: email,
              linkedEmail: email,
              linkedUids: mergedLinkedUids,
              googleUid: googleUid || null,
              isEmailVerified: true,
              emailVerifiedAt: nowIso,
              customAvatarUrl: photoUrl || null,
            }, { merge: true });
          } catch (e) {
            console.warn('Firestore set user notice:', e);
          }

          // Update accounts record by username key OR fallback query by uid
          try {
            const identifier = userProfile?.username || currentUsr.displayName || '';
            let updatedAccount = false;
            if (identifier) {
              const accountKey = await getAccountKey(identifier.trim().toLowerCase());
              const accSnap = await getDoc(doc(db, 'accounts', accountKey));
              if (accSnap.exists()) {
                await setDoc(accSnap.ref, {
                  email: email,
                  linkedEmail: email,
                  linkedUids: mergedLinkedUids,
                  googleUid: googleUid || null,
                  isEmailVerified: true,
                  emailVerifiedAt: nowIso,
                }, { merge: true });
                updatedAccount = true;
              }
            }
            if (!updatedAccount) {
              const byUid = await getDocs(query(collection(db, 'accounts'), where('uid', '==', currentUsr.uid)));
              for (const d of byUid.docs) {
                await setDoc(d.ref, {
                  email: email,
                  linkedEmail: email,
                  linkedUids: mergedLinkedUids,
                  googleUid: googleUid || null,
                  isEmailVerified: true,
                  emailVerifiedAt: nowIso,
                }, { merge: true });
              }
            }
          } catch (e) {
            console.warn('Firestore set account notice:', e);
          }

          await updatePresence(currentUsr.uid, updatedProf).catch(() => {});

          // Keep the custom ClSend account active instead of leaving Firebase Google Auth signed in
          if (currentUsr.authProvider === 'account' || currentUsr.uid.startsWith('u_')) {
            await signOut(auth).catch(() => {});
          }
        }
        return { email, photoURL: photoUrl };
      }
      return null;
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return null;
      }
      console.warn('Link Google account error:', err);
      throw err;
    } finally {
      setTimeout(() => {
        isLinkingAccountRef.current = false;
      }, 1500);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        settings,
        loading,
        loginWithGoogle,
        loginWithFacebook,
        loginWithGithub,
        pendingCredentialLink,
        confirmPendingCredentialLink,
        clearPendingCredentialLink,
        sendPhoneLoginOtp,
        confirmPhoneLoginOtp,
        resetPhoneLoginState,
        loginWithEmail,
        loginWithAccount,
        registerWithEmail,
        registerWithAccount,
        loginAsGuest,
        logout,
        updateSettings,
        changePassword,
        updateDisplayName,
        linkEmail,
        linkPhoneNumber,
        sendEmailVerificationCode,
        verifyEmailCodeAndLink,
        getLoginSessions,
        logoutSession,
        logoutAllDevices,
        syncGoogleProfilePhoto,
        linkWithGoogleAccount,
        updatePresence,
        loginWithSyncPayload,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useOptionalAuth = () => {
  return useContext(AuthContext);
};

