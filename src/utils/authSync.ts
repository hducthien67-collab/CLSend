import QRCode from 'qrcode';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AppUser, UserDevice, AppSettings } from '../types';
import { getClientDeviceId } from '../context/AuthContext';
import { pickActiveLang } from '../context/LanguageContext';

export interface AuthSyncPayload {
  userSession: AppUser;
  profileData: UserDevice;
  settings?: Partial<AppSettings>;
  authorizedDeviceName?: string;
  authorizedAt?: string;
}

export interface AuthSyncSessionDoc {
  code: string;
  status: 'waiting' | 'authenticated' | 'expired' | 'cancelled';
  createdAt?: any;
  createdAtMs: number;
  expiresAt: number;
  desktopDeviceId?: string;
  desktopDeviceName?: string;
  payload?: AuthSyncPayload;
}

/**
 * Generate a clean 6-digit sync code (e.g. "842915")
 */
export const generateSyncCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Formats a 6-digit sync code for display: "842 915"
 */
export const formatSyncCode = (code: string): string => {
  const clean = code.replace(/[^0-9]/g, '');
  if (clean.length === 6) {
    return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  }
  return code;
};

/**
 * Creates a new Auth Sync session in Firestore for Desktop / Web pairing.
 * Generates an SVG/DataURL QR code for instant phone / web camera scanning.
 */
export const createDesktopSyncSession = async (
  deviceName: string,
  onAuthenticated: (payload: AuthSyncPayload) => void,
  onError?: (err: any) => void
): Promise<{
  code: string;
  qrDataUrl: string;
  directSyncUrl: string;
  cancel: () => void;
}> => {
  const code = generateSyncCode();
  const deviceId = getClientDeviceId();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes lifespan

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://clsend.app';
  const directSyncUrl = `${baseUrl}/?syncCode=${code}`;

  // Generate crisp QR code data URL
  const qrDataUrl = await QRCode.toDataURL(directSyncUrl, {
    width: 280,
    margin: 2,
    color: {
      dark: '#022c22', // deep emerald
      light: '#f0fdf4', // mint light
    },
    errorCorrectionLevel: 'M',
  });

  const syncDocRef = doc(db, 'auth_sync', code);
  await setDoc(syncDocRef, {
    code,
    status: 'waiting',
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
    expiresAt,
    desktopDeviceId: deviceId,
    desktopDeviceName: deviceName || pickActiveLang('Ứng dụng ClSend Desktop', 'ClSend Desktop App', 'ClSend 桌面应用'),
  });

  // Listen in real-time for authorization from Web/Phone
  const unsubscribe = onSnapshot(
    syncDocRef,
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as AuthSyncSessionDoc;

      if (data.status === 'authenticated' && data.payload) {
        // Authenticated! Clean up document and trigger callback
        deleteDoc(syncDocRef).catch(() => {});
        onAuthenticated(data.payload);
      }
    },
    (err) => {
      console.warn('Auth sync snapshot listener notice:', err);
      if (onError) onError(err);
    }
  );

  const cancel = () => {
    unsubscribe();
    deleteDoc(syncDocRef).catch(() => {});
  };

  return {
    code,
    qrDataUrl,
    directSyncUrl,
    cancel,
  };
};

/**
 * Verifies if a sync code exists and is currently waiting
 */
export const verifySyncCode = async (
  rawCode: string
): Promise<{
  valid: boolean;
  message?: string;
  data?: AuthSyncSessionDoc;
}> => {
  const cleanCode = rawCode.replace(/[^0-9]/g, '').trim();
  if (cleanCode.length !== 6) {
    return { valid: false, message: pickActiveLang('Mã đồng bộ phải gồm đúng 6 chữ số.', 'Sync code must be exactly 6 digits.', '同步码必须为 6 位数字。') };
  }

  const syncDocRef = doc(db, 'auth_sync', cleanCode);
  const snap = await getDoc(syncDocRef);

  if (!snap.exists()) {
    return { valid: false, message: pickActiveLang('Mã đồng bộ không tồn tại hoặc đã hết hạn.', 'Sync code does not exist or has expired.', '同步码不存在或已过期。') };
  }

  const data = snap.data() as AuthSyncSessionDoc;
  if (data.status !== 'waiting') {
    return { valid: false, message: pickActiveLang('Mã đồng bộ này đã được sử dụng hoặc đã hủy.', 'This sync code has already been used or cancelled.', '此同步码已被使用或已取消。') };
  }

  if (Date.now() > data.expiresAt) {
    deleteDoc(syncDocRef).catch(() => {});
    return { valid: false, message: pickActiveLang('Mã đồng bộ này đã quá hạn 10 phút. Vui lòng lấy mã mới.', 'This sync code expired after 10 minutes. Please generate a new one.', '此同步码已超过 10 分钟有效期，请重新获取。') };
  }

  return { valid: true, data };
};

/**
 * Authorizes a desktop session using the logged-in Web user credentials
 */
export const authorizeSyncCode = async (
  rawCode: string,
  userSession: AppUser,
  profileData: UserDevice,
  settings?: AppSettings
): Promise<{ success: boolean; message: string }> => {
  const check = await verifySyncCode(rawCode);
  if (!check.valid || !check.data) {
    return { success: false, message: check.message || pickActiveLang('Mã đồng bộ không hợp lệ.', 'Invalid sync code.', '同步码无效。') };
  }

  const cleanCode = rawCode.replace(/[^0-9]/g, '').trim();
  const syncDocRef = doc(db, 'auth_sync', cleanCode);

  const payload: AuthSyncPayload = {
    userSession: {
      uid: userSession.uid,
      email: userSession.email,
      displayName: userSession.displayName,
      photoURL: userSession.photoURL || null,
    },
    profileData: {
      uid: profileData.uid,
      email: profileData.email,
      username: profileData.username,
      displayName: profileData.displayName,
      deviceName: profileData.deviceName,
      deviceType: profileData.deviceType,
      avatarColor: profileData.avatarColor,
      customAvatarUrl: profileData.customAvatarUrl,
      bannerUrl: profileData.bannerUrl,
      customBio: profileData.customBio,
      customBadgeText: profileData.customBadgeText,
      createdAt: profileData.createdAt,
    },
    settings: settings
      ? {
          deviceName: settings.deviceName,
          avatarColor: settings.avatarColor,
          customAvatarUrl: settings.customAvatarUrl,
          soundEnabled: settings.soundEnabled,
          autoAccept: settings.autoAccept,
        }
      : undefined,
    authorizedDeviceName: settings?.deviceName || pickActiveLang('Trình duyệt Web', 'Web Browser', 'Web 浏览器'),
    authorizedAt: new Date().toISOString(),
  };

  await setDoc(
    syncDocRef,
    {
      status: 'authenticated',
      payload,
    },
    { merge: true }
  );

  return {
    success: true,
    message: pickActiveLang(
      'Đã cấp quyền đăng nhập thành công cho {device}!',
      'Successfully authorized login for {device}!',
      '已成功为 {device} 授权登录！'
    ).replace('{device}', check.data.desktopDeviceName || pickActiveLang('ứng dụng máy tính', 'desktop app', '桌面应用')),
  };
};
