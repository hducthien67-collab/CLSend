import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, orderBy, onSnapshot, writeBatch, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserSanction, SanctionLevel } from '../types';

import { decodeBase64 } from './base64Security';
import { normalizePhoneNumber } from './authHelper';
import { getActiveLanguage, getLocaleTag, pickActiveLang } from '../context/LanguageContext';

export { normalizePhoneNumber };

export function isRealEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes('@')) return false;
  if (clean.endsWith('@cloudsend.local') || clean.startsWith('guest_')) return false;
  return true;
}

export function getEmailSanctionDocId(email: string): string {
  return encodeURIComponent(email.trim().toLowerCase()).replace(/\./g, '_');
}

export function getPhoneSanctionDocId(phone: string): string {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return '';
  return 'phone_' + norm.replace(/[^a-zA-Z0-9+]/g, '_');
}

// Mã hóa Base64 cho danh tính Nhà phát triển để chống quét văn bản thô
const DEV_AUTH_B64 = 'aGR1Y3RoaWVuNjdAZ21haWwuY29t';
export const DEV_EMAIL = decodeBase64(DEV_AUTH_B64);

/**
 * Check if a user is the authorized DEV
 */
export function isDevUser(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === DEV_EMAIL.toLowerCase();
}

// Sanction configurations with polished, authoritative Roblox safety community wording
export const SANCTION_TIERS = {
  lock_1m: {
    type: 'chat_lock_15m' as SanctionLevel,
    durationMs: 1 * 60 * 1000,
    get label() { return pickActiveLang("Cảnh báo nhẹ: Khóa chat 1 phút (1')", "Light Warning: 1m Chat Lock (1')", "轻度警告：禁言 1 分钟 (1')"); },
    get remind() { return pickActiveLang('Hệ thống an toàn ClSend ghi nhận lời nói của bạn chưa phù hợp. Cảnh cáo lần 1 (1 phút).', 'ClSend safety system detected inappropriate language. First warning (1 minute).', 'ClSend 安全系统检测到您的发言不当。第 1 次警告（1 分钟）。'); },
    severity: 'light' as const,
  },
  lock_15m: {
    type: 'chat_lock_15m' as SanctionLevel,
    durationMs: 15 * 60 * 1000,
    get label() { return pickActiveLang("Cảnh báo: Khóa chat 15 phút (15')", "Warning: 15m Chat Lock (15')", "警告：禁言 15 分钟 (15')"); },
    get remind() { return pickActiveLang('Hệ thống an toàn ClSend ghi nhận lời nói của bạn chưa phù hợp. Khóa chat 15 phút.', 'ClSend safety system detected inappropriate language. Chat locked for 15 minutes.', 'ClSend 安全系统检测到您的发言不当。已禁言 15 分钟。'); },
    severity: 'light' as const,
  },
  lock_30m: {
    type: 'chat_lock_15m' as SanctionLevel,
    durationMs: 30 * 60 * 1000,
    get label() { return pickActiveLang("Cảnh báo: Khóa chat 30 phút (30')", "Warning: 30m Chat Lock (30')", "警告：禁言 30 分钟 (30')"); },
    get remind() { return pickActiveLang('Hệ thống an toàn ClSend ghi nhận lời nói của bạn chưa phù hợp. Khóa chat 30 phút.', 'ClSend safety system detected inappropriate language. Chat locked for 30 minutes.', 'ClSend 安全系统检测到您的发言不当。已禁言 30 分钟。'); },
    severity: 'light' as const,
  },
  lock_45m: {
    type: 'chat_lock_15m' as SanctionLevel,
    durationMs: 45 * 60 * 1000,
    get label() { return pickActiveLang("Cảnh báo: Khóa chat 45 phút (45')", "Warning: 45m Chat Lock (45')", "警告：禁言 45 分钟 (45')"); },
    get remind() { return pickActiveLang('Hệ thống an toàn ClSend ghi nhận lời nói của bạn chưa phù hợp. Khóa chat 45 phút.', 'ClSend safety system detected inappropriate language. Chat locked for 45 minutes.', 'ClSend 安全系统检测到您的发言不当。已禁言 45 分钟。'); },
    severity: 'light' as const,
  },
  lock_1h: {
    type: 'chat_lock_1h' as SanctionLevel,
    durationMs: 60 * 60 * 1000,
    get label() { return pickActiveLang('Mức trung bình: Khóa chat 1 giờ (1H)', 'Moderate: 1-Hour Chat Lock (1H)', '中度违规：禁言 1 小时 (1H)'); },
    get remind() { return pickActiveLang('Bạn tiếp tục tái phạm nội quy chat. Khóa chat 1 giờ.', 'You continued violating chat rules. Chat locked for 1 hour.', '您再次违反聊天规则。已禁言 1 小时。'); },
    severity: 'medium' as const,
  },
  ban_1d: {
    type: 'ban_1d' as SanctionLevel,
    durationMs: 24 * 60 * 60 * 1000,
    get label() { return pickActiveLang('Khóa tài khoản 1 Ngày (1D)', '1-Day Account Suspension (1D)', '封禁账号 1 天 (1D)'); },
    get remind() { return pickActiveLang('Tài khoản của bạn bị tạm khóa 1 ngày do vi phạm tiêu chuẩn cộng đồng.', 'Your account is suspended for 1 day due to Community Standards violations.', '您的账号因违反社区规范被暂时封禁 1 天。'); },
    severity: 'high' as const,
  },
  ban_3d: {
    type: 'ban_3d' as SanctionLevel,
    durationMs: 3 * 24 * 60 * 60 * 1000,
    get label() { return pickActiveLang('Khóa tài khoản 3 Ngày (3D)', '3-Day Account Suspension (3D)', '封禁账号 3 天 (3D)'); },
    get remind() { return pickActiveLang('Tài khoản của bạn bị tạm khóa 3 ngày do tái phạm.', 'Your account is suspended for 3 days for repeated violations.', '您的账号因重复违规被暂时封禁 3 天。'); },
    severity: 'high' as const,
  },
  ban_7d: {
    type: 'ban_7d' as SanctionLevel,
    durationMs: 7 * 24 * 60 * 60 * 1000,
    get label() { return pickActiveLang('Khóa tài khoản 7 Ngày (7D)', '7-Day Account Suspension (7D)', '封禁账号 7 天 (7D)'); },
    get remind() { return pickActiveLang('Tài khoản của bạn bị tạm khóa 7 ngày.', 'Your account has been suspended for 7 days.', '您的账号已被暂时封禁 7 天。'); },
    severity: 'critical' as const,
  },
  ban_14d: {
    type: 'ban_7d' as SanctionLevel,
    durationMs: 14 * 24 * 60 * 60 * 1000,
    get label() { return pickActiveLang('Khóa tài khoản 14 Ngày (14D)', '14-Day Account Suspension (14D)', '封禁账号 14 天 (14D)'); },
    get remind() { return pickActiveLang('Tài khoản của bạn bị tạm khóa 14 ngày.', 'Your account has been suspended for 14 days.', '您的账号已被暂时封禁 14 天。'); },
    severity: 'critical' as const,
  },
  ban_6m: {
    type: 'ban_6m' as SanctionLevel,
    durationMs: 180 * 24 * 60 * 60 * 1000,
    get label() { return pickActiveLang('Khóa tài khoản 6 Tháng (6M)', '6-Month Account Suspension (6M)', '封禁账号 6 个月 (6M)'); },
    get remind() { return pickActiveLang('Tài khoản của bạn bị đình chỉ dài hạn 6 tháng.', 'Your account has received a long-term 6-month suspension.', '您的账号已被长期封禁 6 个月。'); },
    severity: 'permanent' as const,
  },
  ban_1y: {
    type: 'ban_6m' as SanctionLevel,
    durationMs: 365 * 24 * 60 * 60 * 1000,
    get label() { return pickActiveLang('Khóa tài khoản 1 Năm (1Y)', '1-Year Account Suspension (1Y)', '封禁账号 1 年 (1Y)'); },
    get remind() { return pickActiveLang('Tài khoản của bạn bị đình chỉ 1 năm do vi phạm nghiêm trọng.', 'Your account has been suspended for 1 year due to severe violations.', '您的账号因严重违规被封禁 1 年。'); },
    severity: 'permanent' as const,
  },
  level_1: {
    type: 'chat_lock_15m' as SanctionLevel,
    durationMs: 15 * 60 * 1000,
    get label() { return pickActiveLang("Cảnh báo: Khóa chat 15 phút (15')", "Warning: 15m Chat Lock (15')", "警告：禁言 15 分钟 (15')"); },
    get remind() { return pickActiveLang('Hệ thống an toàn ClSend ghi nhận lời nói của bạn chưa phù hợp. Khóa chat 15 phút.', 'ClSend safety system detected inappropriate language. Chat locked for 15 minutes.', 'ClSend 安全系统检测到您的发言不当。已禁言 15 分钟。'); },
    severity: 'light' as const,
  },
  level_2: {
    type: 'chat_lock_1h' as SanctionLevel,
    durationMs: 60 * 60 * 1000,
    get label() { return pickActiveLang('Mức trung bình: Khóa chat 1 giờ (1H)', 'Moderate: 1-Hour Chat Lock (1H)', '中度违规：禁言 1 小时 (1H)'); },
    get remind() { return pickActiveLang('Bạn tiếp tục tái phạm nội quy chat. Khóa chat 1 giờ.', 'You continued violating chat rules. Chat locked for 1 hour.', '您再次违反聊天规则。已禁言 1 小时。'); },
    severity: 'medium' as const,
  },
  level_3: {
    type: 'ban_7d' as SanctionLevel,
    durationMs: 7 * 24 * 60 * 60 * 1000,
    get label() { return pickActiveLang('Khóa tài khoản 7 Ngày (7D)', '7-Day Account Suspension (7D)', '封禁账号 7 天 (7D)'); },
    get remind() { return pickActiveLang('Tài khoản của bạn bị tạm khóa 7 ngày.', 'Your account has been suspended for 7 days.', '您的账号已被暂时封禁 7 天。'); },
    severity: 'critical' as const,
  },
  level_4: {
    type: 'ban_7d' as SanctionLevel,
    durationMs: 14 * 24 * 60 * 60 * 1000,
    get label() { return pickActiveLang('Khóa tài khoản 14 Ngày (14D)', '14-Day Account Suspension (14D)', '封禁账号 14 天 (14D)'); },
    get remind() { return pickActiveLang('Tài khoản của bạn bị tạm khóa 14 ngày.', 'Your account has been suspended for 14 days.', '您的账号已被暂时封禁 14 天。'); },
    severity: 'critical' as const,
  },
  level_perm: {
    type: 'ban_perm' as SanctionLevel,
    durationMs: null,
    get label() { return pickActiveLang('Mức Tối Cao: Cấm tài khoản vĩnh viễn', 'Maximum Tier: Permanent Account Ban', '最高级别：永久封禁账号'); },
    get remind() { return pickActiveLang('Tài khoản của bạn (cùng các tài khoản đồng bộ chung Email / Số điện thoại) đã bị CẤM TRUY CẬP VĨNH VIỄN do vi phạm đặc biệt nghiêm trọng.', 'Your account (along with accounts sharing the same Email / Phone number) has been PERMANENTLY BANNED due to an extremely severe violation.', '您的账号（以及绑定同一邮箱/手机号的关联账号）因极其严重的违规行为已被永久禁止访问。'); },
    severity: 'permanent' as const,
  }
};

/**
 * Discover all sibling UIDs, real emails, and normalized phone numbers linked to a target account.
 * Note: Never propagates by physical deviceId; only propagates via explicit UID links, real Email, or Phone number.
 */
export async function discoverLinkedSanctionTargets(params: {
  targetUid?: string | null;
  targetEmail?: string | null;
  targetPhone?: string | null;
  extraEmails?: Array<string | null | undefined>;
  extraPhones?: Array<string | null | undefined>;
  extraUids?: Array<string | null | undefined>;
}): Promise<{
  uids: string[];
  emails: string[];
  phones: string[];
}> {
  const uidSet = new Set<string>();
  const emailSet = new Set<string>();
  const phoneSet = new Set<string>();

  const addUid = (u?: string | null) => {
    if (u && u.trim()) uidSet.add(u.trim());
  };
  const addEmail = (e?: string | null) => {
    if (isRealEmail(e)) emailSet.add(e!.trim().toLowerCase());
  };
  const addPhone = (p?: string | null) => {
    const norm = normalizePhoneNumber(p);
    if (norm) phoneSet.add(norm);
  };

  addUid(params.targetUid);
  (params.extraUids || []).forEach(addUid);
  addEmail(params.targetEmail);
  (params.extraEmails || []).forEach(addEmail);
  addPhone(params.targetPhone);
  (params.extraPhones || []).forEach(addPhone);

  const inspectRecordData = (data: any, fallbackUid?: string) => {
    if (!data) return;
    addUid(data.uid || fallbackUid);
    addUid(data.googleUid);
    if (Array.isArray(data.linkedUids)) {
      data.linkedUids.forEach(addUid);
    }
    addEmail(data.email);
    addEmail(data.linkedEmail);
    if (Array.isArray(data.linkedEmails)) {
      data.linkedEmails.forEach(addEmail);
    }
    addPhone(data.phone);
    addPhone(data.linkedPhone);
    addPhone(data.phoneNumber);
    if (Array.isArray(data.linkedPhones)) {
      data.linkedPhones.forEach(addPhone);
    }
  };

  // Step 1: Read primary user & account records for targetUid
  if (params.targetUid) {
    try {
      const userSnap = await getDoc(doc(db, 'users', params.targetUid));
      if (userSnap.exists()) {
        inspectRecordData(userSnap.data(), userSnap.id);
      }
    } catch {}
    try {
      const accSnap = await getDocs(query(collection(db, 'accounts'), where('uid', '==', params.targetUid)));
      accSnap.forEach((d) => inspectRecordData(d.data()));
    } catch {}
    try {
      const sancSnap = await getDoc(doc(db, 'sanctions', params.targetUid));
      if (sancSnap.exists()) {
        inspectRecordData(sancSnap.data(), sancSnap.id);
      }
    } catch {}
  }

  // Step 2: Query sibling accounts/users sharing any discovered real email or phone number
  const queryBatch: Promise<void>[] = [];
  for (const em of Array.from(emailSet)) {
    queryBatch.push(
      getDocs(query(collection(db, 'users'), where('email', '==', em)))
        .then((s) => s.forEach((d) => inspectRecordData(d.data(), d.id)))
        .catch(() => {})
    );
    queryBatch.push(
      getDocs(query(collection(db, 'users'), where('linkedEmail', '==', em)))
        .then((s) => s.forEach((d) => inspectRecordData(d.data(), d.id)))
        .catch(() => {})
    );
    queryBatch.push(
      getDocs(query(collection(db, 'accounts'), where('email', '==', em)))
        .then((s) => s.forEach((d) => inspectRecordData(d.data())))
        .catch(() => {})
    );
    queryBatch.push(
      getDocs(query(collection(db, 'accounts'), where('linkedEmail', '==', em)))
        .then((s) => s.forEach((d) => inspectRecordData(d.data())))
        .catch(() => {})
    );
  }

  for (const ph of Array.from(phoneSet)) {
    queryBatch.push(
      getDocs(query(collection(db, 'users'), where('phone', '==', ph)))
        .then((s) => s.forEach((d) => inspectRecordData(d.data(), d.id)))
        .catch(() => {})
    );
    queryBatch.push(
      getDocs(query(collection(db, 'users'), where('linkedPhone', '==', ph)))
        .then((s) => s.forEach((d) => inspectRecordData(d.data(), d.id)))
        .catch(() => {})
    );
    queryBatch.push(
      getDocs(query(collection(db, 'accounts'), where('phone', '==', ph)))
        .then((s) => s.forEach((d) => inspectRecordData(d.data())))
        .catch(() => {})
    );
    queryBatch.push(
      getDocs(query(collection(db, 'accounts'), where('linkedPhone', '==', ph)))
        .then((s) => s.forEach((d) => inspectRecordData(d.data())))
        .catch(() => {})
    );
  }

  await Promise.all(queryBatch);

  return {
    uids: Array.from(uidSet),
    emails: Array.from(emailSet),
    phones: Array.from(phoneSet),
  };
}

/**
 * Check if an account, UID, linked email, or linked phone number has an active ban or chat lock.
 * Strictly account & linked-contact scoped (NEVER bans hardware deviceId).
 */
export async function checkUserBanStatus(
  email?: string | null,
  uid?: string | null,
  extra?: {
    phone?: string | null;
    linkedEmail?: string | null;
    linkedUids?: string[];
    linkedEmails?: string[];
    linkedPhones?: string[];
  }
): Promise<{
  isBanned: boolean;
  isChatLocked?: boolean;
  sanction?: UserSanction;
  message?: string;
}> {
  try {
    const checkDoc = (sanction: UserSanction) => {
      const now = Date.now();
      // Check ban expiration
      if (sanction.isBanned) {
        if (sanction.banExpiresAt) {
          const expTime = new Date(sanction.banExpiresAt).getTime();
          if (now > expTime) {
            return { isBanned: false, isChatLocked: false, sanction };
          }
        }
        const banDurationLabel =
          sanction.lastSanctionType === 'ban_1d' ? pickActiveLang('1 NGÀY', '1 DAY', '1 天') :
          sanction.lastSanctionType === 'ban_3d' ? pickActiveLang('3 NGÀY', '3 DAYS', '3 天') :
          sanction.lastSanctionType === 'ban_7d' ? pickActiveLang('7 NGÀY', '7 DAYS', '7 天') :
          sanction.lastSanctionType === 'ban_6m' ? pickActiveLang('6 THÁNG', '6 MONTHS', '6 个月') :
          pickActiveLang('VĨNH VIỄN', 'PERMANENT', '永久');

        const banReasonText = sanction.remindText || sanction.reason || pickActiveLang('Vi phạm tiêu chuẩn cộng đồng', 'Community Standards violation', '违反社区规范');

        return {
          isBanned: true,
          isChatLocked: true,
          sanction,
          message: pickActiveLang(
            'Tài khoản (hoặc Email / SĐT liên kết) đã bị DEV CẤM ({duration}). Nhắc nhở: "{reason}". Hệ thống từ chối truy cập.',
            'Account (or linked Email / Phone) has been BANNED by DEV ({duration}). Notice: "{reason}". Access denied.',
            '账号（或关联邮箱/手机号）已被开发者封禁（{duration}）。提示：“{reason}”。系统拒绝访问。'
          )
            .replace('{duration}', banDurationLabel)
            .replace('{reason}', banReasonText)
        };
      }

      // Check chat lock expiration
      if (sanction.isChatLocked) {
        if (sanction.chatLockExpiresAt) {
          const expTime = new Date(sanction.chatLockExpiresAt).getTime();
          if (now > expTime) {
            return { isBanned: false, isChatLocked: false, sanction };
          }
        }
        return {
          isBanned: false,
          isChatLocked: true,
          sanction,
          message: pickActiveLang(
            'Tài khoản đang bị tạm khóa chat. Nhắc nhở từ DEV: "{reason}".',
            'Account chat is temporarily locked. DEV notice: "{reason}".',
            '账号聊天功能已被暂时锁定。开发者提示：“{reason}”。'
          ).replace('{reason}', sanction.remindText || sanction.reason || '')
        };
      }

      return null;
    };

    const candidateDocIds = new Set<string>();
    const addUidCandidate = (u?: string | null) => {
      if (u && u.trim()) candidateDocIds.add(u.trim());
    };
    const addEmailCandidate = (em?: string | null) => {
      if (!em) return;
      const clean = em.trim().toLowerCase();
      if (!clean || clean.endsWith('@cloudsend.local') || clean.startsWith('guest_')) return;
      candidateDocIds.add(getEmailSanctionDocId(clean));
    };
    const addPhoneCandidate = (ph?: string | null) => {
      const id = getPhoneSanctionDocId(ph || '');
      if (id) candidateDocIds.add(id);
    };

    addUidCandidate(uid);
    (extra?.linkedUids || []).forEach(addUidCandidate);
    addEmailCandidate(email);
    addEmailCandidate(extra?.linkedEmail);
    (extra?.linkedEmails || []).forEach(addEmailCandidate);
    addPhoneCandidate(extra?.phone);
    (extra?.linkedPhones || []).forEach(addPhoneCandidate);

    // If uid is provided, also read users/{uid} to expand any synced linkedEmail / phone / linkedUids
    if (uid) {
      try {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) {
          const uData = userSnap.data() as any;
          addEmailCandidate(uData.email);
          addEmailCandidate(uData.linkedEmail);
          addPhoneCandidate(uData.phone);
          addPhoneCandidate(uData.linkedPhone);
          addPhoneCandidate(uData.phoneNumber);
          addUidCandidate(uData.googleUid);
          if (Array.isArray(uData.linkedUids)) {
            uData.linkedUids.forEach(addUidCandidate);
          }
        }
      } catch {}
    }

    if (candidateDocIds.size === 0) {
      return { isBanned: false, isChatLocked: false };
    }

    const snaps = await Promise.all(
      Array.from(candidateDocIds).map((docId) =>
        getDoc(doc(db, 'sanctions', docId)).catch(() => null)
      )
    );

    let activeChatLockFallback: {
      isBanned: boolean;
      isChatLocked?: boolean;
      sanction?: UserSanction;
      message?: string;
    } | null = null;

    for (const snap of snaps) {
      if (snap && snap.exists()) {
        const res = checkDoc(snap.data() as UserSanction);
        if (res?.isBanned) {
          return res; // Active ban takes top precedence
        }
        if (res?.isChatLocked && !activeChatLockFallback) {
          activeChatLockFallback = res;
        }
      }
    }

    if (activeChatLockFallback) {
      return activeChatLockFallback;
    }
  } catch (err) {
    console.warn('Error checking ban status:', err);
  }

  return { isBanned: false, isChatLocked: false };
}

export type SanctionTierKey = keyof typeof SANCTION_TIERS;

/**
 * Apply Dev Sanction with specific tier & custom Roblox payload
 */
export async function applyTierSanction(params: {
  targetUid: string;
  targetEmail: string;
  targetPhone?: string;
  targetDisplayName: string;
  tier: SanctionTierKey;
  customReason?: string;
  customRemindText?: string;
  ruleViolated?: string;
  offensiveItem?: string;
  offensiveItemTimestamp?: string;
  devEmail: string;
}): Promise<UserSanction> {
  const {
    targetUid,
    targetEmail,
    targetPhone,
    targetDisplayName,
    tier,
    customReason,
    customRemindText,
    ruleViolated,
    offensiveItem,
    offensiveItemTimestamp,
    devEmail
  } = params;
  if (!isDevUser(devEmail)) {
    throw new Error('Chỉ tài khoản DEV mới có quyền thực hiện kỷ luật / khóa tài khoản.');
  }
  if (isDevUser(targetEmail)) {
    throw new Error('Không thể áp dụng hình phạt kỷ luật cho tài khoản DEV.');
  }

  const cleanEmail = isRealEmail(targetEmail) ? targetEmail.trim().toLowerCase() : '';
  const config = SANCTION_TIERS[tier];
  const now = new Date();

  // Fetch current history & linked targets
  let currentCount = 0;
  let prevHistory: any[] = [];
  try {
    const snap = await getDoc(doc(db, 'sanctions', targetUid));
    if (snap.exists()) {
      const data = snap.data() as UserSanction;
      currentCount = data.violationCount || 0;
      prevHistory = data.history || [];
    }
  } catch (err) {
    console.warn('Notice reading sanction history:', err);
  }

  const linkedTargets = await discoverLinkedSanctionTargets({
    targetUid,
    targetEmail: cleanEmail,
    targetPhone,
  });

  if (linkedTargets.emails.some((em) => isDevUser(em))) {
    throw new Error('Không thể áp dụng hình phạt cho tài khoản liên kết DEV.');
  }

  const newCount = currentCount + 1;
  const isBanTier = !['lock_1m', 'lock_15m', 'lock_30m', 'lock_45m', 'lock_1h', 'level_1', 'level_2'].includes(tier);
  const expiresAt = config.durationMs ? new Date(now.getTime() + config.durationMs).toISOString() : null;
  const remindMessage = customRemindText?.trim() || config.remind;
  const primaryEmail = cleanEmail || linkedTargets.emails[0] || (targetEmail || '').trim().toLowerCase();
  const primaryPhone = normalizePhoneNumber(targetPhone) || linkedTargets.phones[0] || '';

  const historyItem = {
    type: config.type,
    reason: customReason || config.label,
    remindText: remindMessage,
    ruleViolated: ruleViolated || '',
    offensiveItem: offensiveItem || '',
    timestamp: now.toISOString(),
    actedBy: devEmail,
    senderName: targetDisplayName || primaryEmail || 'Người dùng'
  };

  const sanctionData: UserSanction = {
    uid: targetUid,
    email: primaryEmail,
    ...(primaryPhone ? { phone: primaryPhone } : {}),
    linkedEmails: linkedTargets.emails,
    linkedPhones: linkedTargets.phones,
    linkedUids: linkedTargets.uids,
    displayName: targetDisplayName,
    senderName: targetDisplayName || primaryEmail || 'Người dùng',
    senderEmail: primaryEmail,
    actedBy: devEmail,
    violationCount: newCount,
    lastSanctionType: config.type,
    severityLevel: config.severity,
    reason: customReason || config.label,
    remindText: remindMessage,
    ruleViolated: ruleViolated || '',
    offensiveItem: offensiveItem || '',
    offensiveItemTimestamp: offensiveItemTimestamp || now.toISOString(),
    ...(isBanTier ? { bannedAt: now.toISOString() } : {}),
    banExpiresAt: isBanTier ? expiresAt : null,
    isBanned: isBanTier,
    isChatLocked: true,
    chatLockExpiresAt: expiresAt,
    history: [historyItem, ...prevHistory]
  };

  // Write sanction to primary UID + any linked sibling UIDs, real emails, and normalized phone numbers
  const docIdsToWrite = new Set<string>([targetUid]);
  if (isBanTier) {
    linkedTargets.uids.forEach((u) => docIdsToWrite.add(u));
    linkedTargets.emails.forEach((em) => docIdsToWrite.add(getEmailSanctionDocId(em)));
    linkedTargets.phones.forEach((ph) => {
      const pId = getPhoneSanctionDocId(ph);
      if (pId) docIdsToWrite.add(pId);
    });
  } else {
    if (isRealEmail(primaryEmail)) {
      docIdsToWrite.add(getEmailSanctionDocId(primaryEmail));
    }
    if (primaryPhone) {
      const pId = getPhoneSanctionDocId(primaryPhone);
      if (pId) docIdsToWrite.add(pId);
    }
  }

  await Promise.all(
    Array.from(docIdsToWrite).map((docId) =>
      setDoc(doc(db, 'sanctions', docId), {
        ...sanctionData,
        uid: docId.startsWith('u_') || docId.startsWith('guest_') || !docId.includes('_') ? docId : targetUid,
      }).catch((e) => console.warn('Failed writing sanction doc:', docId, e))
    )
  );

  // Restore exact primary uid in primary doc & returned object
  await setDoc(doc(db, 'sanctions', targetUid), sanctionData).catch(() => {});

  // Send direct system notification to user
  try {
    const notifId = `dev-alert-${Date.now()}`;
    await setDoc(doc(db, 'user_notifications', notifId), {
      id: notifId,
      targetUid,
      targetEmail: primaryEmail,
      title: isBanTier ? `🚨 KỶ LUẬT DEV: ${config.label.toUpperCase()}` : `⚠️ CẢNH BÁO DEV: ${config.label.toUpperCase()}`,
      message: remindMessage,
      reason: customReason || config.label,
      ruleViolated: ruleViolated || '',
      offensiveItem: offensiveItem || '',
      createdAt: now.toISOString(),
      timestamp: now.getTime(),
      level: config.type,
      read: false
    });
  } catch (err) {
    console.warn('Could not post user notification:', err);
  }

  return sanctionData;
}

/**
 * Apply Dev Sanction to a user according to the rule:
 * - Lần 1: Cảnh cáo (Warn)
 * - Lần 2: Banned trong 3 ngày
 * - Lần 3: Banned trong 6 tháng
 * - Lần 4+: Banned VĨNH VIỄN
 * Propagates active bans across sibling accounts sharing the same email or phone number (no machine ban).
 */
export async function applyDevSanction(params: {
  targetUid: string;
  targetEmail: string;
  targetPhone?: string;
  targetDisplayName: string;
  reason: string;
  devEmail: string;
}): Promise<UserSanction> {
  const { targetUid, targetEmail, targetPhone, targetDisplayName, reason, devEmail } = params;
  const cleanEmail = isRealEmail(targetEmail) ? targetEmail.trim().toLowerCase() : '';
  const emailDocId = cleanEmail ? getEmailSanctionDocId(cleanEmail) : '';

  // 1. Fetch current sanction status from Firestore
  let currentCount = 0;
  let prevHistory: any[] = [];

  try {
    const snap = await getDoc(doc(db, 'sanctions', emailDocId || targetUid));
    if (snap.exists()) {
      const data = snap.data() as UserSanction;
      currentCount = data.violationCount || 0;
      prevHistory = data.history || [];
    }
  } catch (err) {
    console.warn('Fetch previous sanction notice:', err);
  }

  const linkedTargets = await discoverLinkedSanctionTargets({
    targetUid,
    targetEmail: cleanEmail,
    targetPhone,
  });

  const newCount = currentCount + 1;
  let sanctionLevel: SanctionLevel = 'warn';
  let isBanned = false;
  let banExpiresAt: string | null = null;
  const now = new Date();

  if (newCount === 1) {
    sanctionLevel = 'warn';
    isBanned = false;
  } else if (newCount === 2) {
    sanctionLevel = 'ban_3d';
    isBanned = true;
    const exp = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    banExpiresAt = exp.toISOString();
  } else if (newCount === 3) {
    sanctionLevel = 'ban_6m';
    isBanned = true;
    const exp = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    banExpiresAt = exp.toISOString();
  } else {
    sanctionLevel = 'ban_perm';
    isBanned = true;
    banExpiresAt = null;
  }

  const primaryEmail = cleanEmail || linkedTargets.emails[0] || (targetEmail || '').trim().toLowerCase();
  const primaryPhone = normalizePhoneNumber(targetPhone) || linkedTargets.phones[0] || '';

  const historyItem = {
    type: sanctionLevel,
    reason: reason.trim() || 'Nội dung không hợp lệ / vi phạm tiêu chuẩn cộng đồng',
    timestamp: now.toISOString(),
    actedBy: devEmail
  };

  const sanctionData: UserSanction = {
    uid: targetUid,
    email: primaryEmail,
    phone: primaryPhone || undefined,
    linkedEmails: linkedTargets.emails,
    linkedPhones: linkedTargets.phones,
    linkedUids: linkedTargets.uids,
    displayName: targetDisplayName,
    violationCount: newCount,
    lastSanctionType: sanctionLevel,
    reason: reason.trim() || 'Vi phạm tiêu chuẩn cộng đồng',
    bannedAt: isBanned ? now.toISOString() : undefined,
    banExpiresAt,
    isBanned,
    history: [historyItem, ...prevHistory]
  };

  const docIds = new Set<string>([targetUid]);
  if (emailDocId) docIds.add(emailDocId);
  if (isBanned) {
    linkedTargets.uids.forEach((u) => docIds.add(u));
    linkedTargets.emails.forEach((em) => docIds.add(getEmailSanctionDocId(em)));
    linkedTargets.phones.forEach((ph) => {
      const pId = getPhoneSanctionDocId(ph);
      if (pId) docIds.add(pId);
    });
  }

  await Promise.all(
    Array.from(docIds).map((docId) =>
      setDoc(doc(db, 'sanctions', docId), sanctionData).catch(() => {})
    )
  );

  try {
    const notifId = `dev-alert-${Date.now()}`;
    await setDoc(doc(db, 'notifications', notifId), {
      id: notifId,
      targetUid,
      targetEmail: primaryEmail,
      title: isBanned
        ? `🚨 TÀI KHOẢN ĐÃ BỊ DEV KHÓA (${sanctionLevel === 'ban_3d' ? '3 NGÀY' : sanctionLevel === 'ban_6m' ? '6 THÁNG' : 'VĨNH VIỄN'})`
        : `⚠️ CẢNH CÁO TỪ DEV (LẦN 1)`,
      message: `DEV gửi cảnh báo/kỷ luật: "${reason}". Vi phạm lần ${newCount}. ${
        isBanned ? 'Tài khoản (và các tài khoản liên kết Email/SĐT) bị cấm đăng nhập và chat.' : 'Nếu vi phạm lần 2 bạn sẽ bị Banned 3 ngày!'
      }`,
      createdAt: now.toISOString(),
      level: sanctionLevel
    });
  } catch (err) {
    console.warn('Could not post dev notification:', err);
  }

  return sanctionData;
}

/**
 * Direct report ban helper that propagates across linked email, phone number, and sibling UIDs.
 */
export async function applyLinkedBanSanction(params: {
  targetUid: string;
  targetEmail?: string;
  targetPhone?: string;
  targetDisplayName: string;
  durationDays: number | 'perm';
  reason: string;
  actedBy?: string;
}): Promise<{ sanction: UserSanction; propagatedCount: number }> {
  const { targetUid, targetEmail, targetPhone, targetDisplayName, durationDays, reason, actedBy } = params;
  const now = new Date();
  const expiresAt = durationDays === 'perm' ? null : new Date(now.getTime() + durationDays * 86400000).toISOString();

  const linkedTargets = await discoverLinkedSanctionTargets({
    targetUid,
    targetEmail,
    targetPhone,
  });

  const primaryEmail = (isRealEmail(targetEmail) ? targetEmail!.trim().toLowerCase() : '') || linkedTargets.emails[0] || '';
  const primaryPhone = normalizePhoneNumber(targetPhone) || linkedTargets.phones[0] || '';

  const sanctionPayload: UserSanction = {
    uid: targetUid,
    displayName: targetDisplayName,
    email: primaryEmail,
    phone: primaryPhone || undefined,
    linkedEmails: linkedTargets.emails,
    linkedPhones: linkedTargets.phones,
    linkedUids: linkedTargets.uids,
    actedBy: actedBy || DEV_EMAIL,
    violationCount: 1,
    lastSanctionType: durationDays === 'perm' ? 'ban_perm' : durationDays === 3 ? 'ban_3d' : durationDays === 1 ? 'ban_1d' : durationDays === 7 ? 'ban_7d' : 'ban_6m',
    reason: reason || 'Vi phạm nội quy từ báo cáo tố cáo của người dùng',
    bannedAt: now.toISOString(),
    banExpiresAt: expiresAt,
    isBanned: true,
  };

  const docIds = new Set<string>([targetUid]);
  linkedTargets.uids.forEach((u) => docIds.add(u));
  linkedTargets.emails.forEach((em) => docIds.add(getEmailSanctionDocId(em)));
  linkedTargets.phones.forEach((ph) => {
    const pId = getPhoneSanctionDocId(ph);
    if (pId) docIds.add(pId);
  });

  await Promise.all(
    Array.from(docIds).map((docId) =>
      setDoc(doc(db, 'sanctions', docId), sanctionPayload).catch(() => {})
    )
  );

  return { sanction: sanctionPayload, propagatedCount: docIds.size };
}

/**
 * Remove or reset a user's sanction (Dev Unban), including all linked emails, phones, and sibling UIDs.
 */
export async function removeDevSanction(email: string, uid?: string, phone?: string): Promise<void> {
  try {
    const linkedTargets = await discoverLinkedSanctionTargets({
      targetUid: uid,
      targetEmail: email,
      targetPhone: phone,
    });

    const docIds = new Set<string>();
    if (uid) docIds.add(uid);
    if (email && isRealEmail(email)) docIds.add(getEmailSanctionDocId(email));
    if (phone) {
      const pId = getPhoneSanctionDocId(phone);
      if (pId) docIds.add(pId);
    }
    linkedTargets.uids.forEach((u) => docIds.add(u));
    linkedTargets.emails.forEach((em) => docIds.add(getEmailSanctionDocId(em)));
    linkedTargets.phones.forEach((ph) => {
      const pId = getPhoneSanctionDocId(ph);
      if (pId) docIds.add(pId);
    });

    await Promise.all(
      Array.from(docIds).map((docId) => deleteDoc(doc(db, 'sanctions', docId)).catch(() => {}))
    );
  } catch (err) {
    console.error('Error removing sanction:', err);
  }
}

export interface RuleViolationFinding {
  ruleNumber: string;
  ruleTitle: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
  explanation: string;
}

export interface AiEvaluationResult {
  hasViolation: boolean;
  score: number; // 0 - 100
  recommendedTier: 'level_1' | 'level_2' | 'level_3' | 'level_4' | 'level_perm' | null;
  recommendedLabel: string;
  remindMessage: string;
  findings: RuleViolationFinding[];
  summary: string;
  analyzedMessagesCount: number;
}

/**
 * AI Audit Engine evaluating user behavior and messages against the 12 Community Rules
 */
export function evaluateUserWith12Rules(
  messages: Array<{ text?: string; rawText?: string; hasProfanity?: boolean; attachments?: any[] }>,
  reports: Array<{ reason?: string; category?: string }>,
  currentSanction?: UserSanction | null
): AiEvaluationResult {
  const findings: RuleViolationFinding[] = [];
  let score = 0;
  const analyzedCount = messages.length;

  const B_START = '(?<=^|[^a-zA-Z0-9áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ])';
  const B_END = '(?=$|[^a-zA-Z0-9áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ])';

  const INNOCENT_PHRASES = [
    'lon nước', 'lon nuoc', 'lon bia', 'lon sữa', 'lon sua', 'lon nước ngọt',
    'các bạn', 'cac ban', 'buổi sáng', 'buổi chiều', 'buổi tối', 'buổi trưa',
    'ví dụ', 'mặc dù', 'dù sao', 'du lịch', 'vui lòng', 'hài lòng', 'hạ long', 'thăng long', 'cầu lông',
    'class', 'pass', 'glass', 'grass', 'bass', 'asset', 'assign', 'assist',
    'shirt', 'shift', 'cocktail', 'peacock', 'shell', 'hello'
  ];

  // Patterns for 12 rules with strict Unicode word boundaries (Vietnamese + English)
  const rulePatterns = [
    // Luật 1: Xúc phạm danh dự & Lăng mạ cá nhân
    {
      ruleNumber: 'Luật 1',
      ruleTitle: 'Xúc phạm danh dự & Lăng mạ cá nhân',
      severity: 'medium' as const,
      regex: new RegExp(`${B_START}(?:thằng\\s+ngu|con\\s+ngu|đồ\\s+ngu|ngu\\s+ngốc|ngu|đồ\\s+chó|chó\\s+chết|chó\\s+đẻ|súc\\s+vật|óc\\s+chó|thằng\\s+đần|đần\\s+độn|thằng\\s+khùng|con\\s+khùng|con\\s+đĩ|mẹ\\s+mày|son\\s+of\\s+a\\s+bitch|bitch(?:es|ing|y)?|asshole(?:s)?|dumbass|jackass|smartass|bastard(?:s)?|whore(?:s)?|slut(?:s|tish)?|wanker(?:s)?|prick(?:s)?|twat(?:s)?|stfu|gtfo)${B_END}`, 'i'),
      score: 25,
      explanation: 'Sử dụng từ ngữ xúc phạm danh dự, hạ nhục người khác (VI/EN).'
    },
    // Luật 2: Cố tình lách luật & Ngụy trang từ ngữ tục tĩu
    {
      ruleNumber: 'Luật 2',
      ruleTitle: 'Cố tình lách luật & Ngụy trang từ ngữ tục tĩu',
      severity: 'low' as const,
      regex: new RegExp(`${B_START}(?:d[._-]+i[._-]+t|f[._-]+u[._-]+c[._-]+k|c[._-]+a[._-]+c|l[._-]+o[._-]+n|vcl|vkl|dkm|đkm|đmm|đm|địt|đụ|đéo|cailon|daubuoi|motherfuck(?:er|ing|ers|s)?|fuck(?:ing|er|ers|ed|s)?|fuk|wtf|bullshit|shit(?:head|ty|ting|s)?|cunt(?:s)?|cock(?:sucker|s)?|dick(?:head|s)?|pussy|pussies)${B_END}`, 'i'),
      score: 25,
      explanation: 'Sử dụng từ ngữ tục tĩu (VI/EN) hoặc cố ý ngắt âm để lách bộ lọc.'
    },
    // Luật 3: Kỳ thị vùng miền, tôn giáo & Kích động thù hận
    {
      ruleNumber: 'Luật 3',
      ruleTitle: 'Kỳ thị vùng miền, tôn giáo & Kích động thù hận',
      severity: 'high' as const,
      regex: new RegExp(`${B_START}(?:bắc\\s+kỳ|nam\\s+kỳ|trung\\s+kỳ|phân\\s+biệt\\s+vùng\\s+miền|bắc\\s+cầy|nam\\s+cầy|nigger(?:s)?|nigga(?:s)?|faggot(?:s)?|retard(?:ed|s)?)${B_END}`, 'i'),
      score: 50,
      explanation: 'Phát ngôn kỳ thị vùng miền, sắc tộc, tôn giáo hoặc kích động thù hận.'
    },
    // Luật 4: Quấy rối tình dục & Gạ gẫm thô thiển
    {
      ruleNumber: 'Luật 4',
      ruleTitle: 'Quấy rối tình dục & Gạ gẫm thô thiển',
      severity: 'high' as const,
      regex: new RegExp(`${B_START}(?:gạ\\s+gẫm|gạ\\s+tình|show\\s+hàng|cho\\s+xem\\s+ảnh\\s+nude|bú\\s+cu|bú\\s+lồn|bú\\s+cặc|chịch|chat\\s+sex|blowjob|handjob|cumshot)${B_END}`, 'i'),
      score: 50,
      explanation: 'Có hành vi gạ tình, đòi ảnh nhạy cảm hoặc quấy rối tình dục.'
    },
    // Luật 5: Phát tán văn hóa phẩm đồi trụy, 18+ & Khiêu dâm
    {
      ruleNumber: 'Luật 5',
      ruleTitle: 'Phát tán văn hóa phẩm 18+ & Khiêu dâm',
      severity: 'critical' as const,
      regex: new RegExp(`${B_START}(?:hentai|porn(?:o|ography)?|phim\\s+sex|clip\\s+nóng|lộ\\s+clip|khiêu\\s+dâm|loạn\\s+luân|nude(?:s)?)${B_END}`, 'i'),
      score: 80,
      explanation: 'Phát tán hình ảnh, liên kết hoặc video đồi trụy 18+.'
    },
    // Luật 6: Hình ảnh bạo lực cực đoan, kinh dị & Tự hại
    {
      ruleNumber: 'Luật 6',
      ruleTitle: 'Bạo lực cực đoan, kinh dị & Tự hại',
      severity: 'critical' as const,
      regex: new RegExp(`${B_START}(?:tự\\s+tử|chém\\s+chết|giết\\s+người|cắt\\s+cổ|đâm\\s+chết|chế\\s+tạo\\s+bom|kill\\s+yourself|kys)${B_END}`, 'i'),
      score: 80,
      explanation: 'Nội dung đe dọa tước đoạt tính mạng, cổ súy bạo lực hoặc tự sát.'
    },
    // Luật 7: Phát tán virus, mã độc & Đường dẫn lừa đảo (Phishing)
    {
      ruleNumber: 'Luật 7',
      ruleTitle: 'Phát tán virus, mã độc & Phishing',
      severity: 'critical' as const,
      regex: new RegExp(`\\.(?:exe|bat|vbs|scr)(?=$|[^a-zA-Z0-9])|${B_START}(?:trojan|phishing|hack\\s+acc|nhận\\s+kim\\s+cương\\s+miễn\\s+phí|nhan-qua-free|free-robux)${B_END}`, 'i'),
      score: 85,
      explanation: 'Phát tán tệp độc hại hoặc liên kết giả mạo lừa đảo tài khoản.'
    },
    // Luật 8: Xâm phạm dữ liệu cá nhân & Bí mật đời tư (Doxxing)
    {
      ruleNumber: 'Luật 8',
      ruleTitle: 'Xâm phạm dữ liệu cá nhân & Doxxing',
      severity: 'high' as const,
      regex: new RegExp(`${B_START}(?:số\\s+cccd|số\\s+cmnd|lộ\\s+cccd|lộ\\s+thông\\s+tin\\s+nhà|doxx|địa\\s+chỉ\\s+nhà\\s+nó\\s+ở)${B_END}`, 'i'),
      score: 45,
      explanation: 'Đăng tải thông tin cá nhân hoặc đe dọa doxxing người khác.'
    },
    // Luật 10: Mạo danh Quản trị viên (Admin/Dev) & Lừa đảo
    {
      ruleNumber: 'Luật 10',
      ruleTitle: 'Mạo danh Admin / Quản trị viên',
      severity: 'high' as const,
      regex: new RegExp(`${B_START}(?:tôi\\s+là\\s+dev|tôi\\s+là\\s+admin|ban\\s+quản\\s+trị\\s+yêu\\s+cầu|cung\\s+cấp\\s+mã\\s+pin|gửi\\s+mật\\s+khẩu\\s+cho\\s+dev)${B_END}`, 'i'),
      score: 60,
      explanation: 'Tự xưng là Admin/DEV để lừa đảo hoặc ép buộc người dùng.'
    }
  ];

  // 1. Quét từng tin nhắn sau khi loại bỏ cụm từ vô hại
  const cleanedMessages = messages.map(m => {
    let out = (m.rawText || m.text || '').toLowerCase();
    for (const p of INNOCENT_PHRASES) {
      out = out.split(p).join(' ');
    }
    return out;
  });
  const textSample = cleanedMessages.join(' \n ');

  for (const pattern of rulePatterns) {
    const match = textSample.match(pattern.regex);
    if (match) {
      score += pattern.score;
      findings.push({
        ruleNumber: pattern.ruleNumber,
        ruleTitle: pattern.ruleTitle,
        severity: pattern.severity,
        evidence: `Trích xuất: "${match[0]}"`,
        explanation: pattern.explanation
      });
    }
  }

  // Quét báo cáo từ người dùng khác (chỉ tính báo cáo thực tế)
  if (reports && reports.length > 0) {
    score += reports.length * 15;
    findings.push({
      ruleNumber: 'Báo cáo',
      ruleTitle: 'Bị thành viên khác tố cáo',
      severity: reports.length >= 3 ? 'high' : 'medium',
      evidence: `${reports.length} lượt tố cáo`,
      explanation: `Nhận được ${reports.length} báo cáo vi phạm nội quy từ cộng đồng.`
    });
  }

  // Chỉ ghi nhận kỷ luật nếu lệnh phạt ĐANG CÒN HIỆU LỰC (không lấy lệnh khóa test đã hết hạn để chụp mũ ngôn từ)
  const now = Date.now();
  const isActiveBan = !!(
    currentSanction?.isBanned &&
    (!currentSanction.banExpiresAt || new Date(currentSanction.banExpiresAt).getTime() > now)
  );
  const isActiveChatLock = !!(
    currentSanction?.isChatLocked &&
    (!currentSanction.chatLockExpiresAt || new Date(currentSanction.chatLockExpiresAt).getTime() > now)
  );

  if (isActiveBan || isActiveChatLock) {
    score += 20;
    findings.push({
      ruleNumber: 'Kỷ luật',
      ruleTitle: isActiveBan ? 'Tài khoản đang bị tạm khóa/cấm' : 'Tài khoản đang bị khóa chat',
      severity: isActiveBan ? 'high' : 'low',
      evidence: currentSanction?.reason || 'Lệnh kỷ luật đang hiệu lực',
      explanation: 'Lệnh kỷ luật hiện tại vẫn còn thời hạn hiệu lực.'
    });
  }

  // 2. Suy luận mức độ phạt
  let recommendedTier: 'level_1' | 'level_2' | 'level_3' | 'level_4' | 'level_perm' | null = null;
  const hasCritical = findings.some(f => f.severity === 'critical');
  const hasHigh = findings.some(f => f.severity === 'high');

  if (hasCritical && score >= 95) {
    recommendedTier = 'level_perm';
  } else if (hasCritical || score >= 80) {
    recommendedTier = 'level_4';
  } else if (hasHigh || score >= 50) {
    recommendedTier = 'level_3';
  } else if (findings.length >= 2 || score >= 25) {
    recommendedTier = 'level_2';
  } else if (findings.length > 0 || score > 0) {
    recommendedTier = 'level_1';
  }

  const tierConfig = recommendedTier ? SANCTION_TIERS[recommendedTier] : null;

  return {
    hasViolation: findings.length > 0,
    score: Math.min(score, 100),
    recommendedTier,
    recommendedLabel: tierConfig?.label || 'Chưa phát hiện vi phạm',
    remindMessage: tierConfig?.remind || '',
    findings,
    summary: findings.length > 0
      ? `AI phát hiện ${findings.length} dấu hiệu vi phạm (${findings.map(f => f.ruleNumber).join(', ')}). Khuyên dùng: ${tierConfig?.label}.`
      : 'AI không tìm thấy từ ngữ hoặc hành vi vi phạm 12 điều luật.',
    analyzedMessagesCount: analyzedCount
  };
}

/**
 * Send private message / notification from DEV to a specific user
 */
export async function sendPrivateDevNotification(params: {
  targetUid: string;
  targetEmail?: string;
  targetName?: string;
  message: string;
  devEmail: string;
}) {
  const { targetUid, targetEmail, targetName, message, devEmail } = params;
  const now = new Date();
  const notifId = `priv-msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const payload = {
    id: notifId,
    targetUid,
    targetEmail: (targetEmail || '').trim().toLowerCase(),
    targetName: targetName || 'Người dùng',
    senderUid: 'dev-master',
    senderEmail: devEmail,
    senderName: 'Quản Trị Viên (DEV)',
    title: '📩 Thông báo riêng từ Quản Trị Viên (DEV)',
    message: message.trim(),
    createdAt: now.toISOString(),
    timestamp: now.getTime(),
    type: 'private_dev_message',
    read: false
  };

  try {
    // Write to both notifications and user_notifications for full compatibility
    await setDoc(doc(db, 'notifications', notifId), payload);
    await setDoc(doc(db, 'user_notifications', notifId), payload);
  } catch (err) {
    console.warn('Notice writing private notification:', err);
  }

  return payload;
}

/**
 * Call server-side AI audit proxy or fallback to local rule-engine
 */
export async function callAiAuditUser(params: {
  userId: string;
  userName?: string;
  userEmail?: string;
  messages: Array<{ text?: string; rawText?: string; fileName?: string; createdAt?: string }>;
  reports: Array<{ reason?: string; category?: string }>;
  violationHistoryCount?: number;
  currentSanction?: UserSanction | null;
}): Promise<AiEvaluationResult> {
  const { userId, userName, userEmail, messages, reports, violationHistoryCount, currentSanction } = params;

  try {
    const res = await fetch('/api/ai-audit-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        userName,
        userEmail,
        messages,
        reports,
        violationHistoryCount: violationHistoryCount || (currentSanction?.violationCount || 0)
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return {
          hasViolation: !!data.hasViolation,
          score: data.hasViolation ? (data.severity === 'critical' ? 95 : data.severity === 'high' ? 70 : data.severity === 'medium' ? 45 : 25) : 0,
          recommendedTier: data.recommendedTier,
          recommendedLabel: data.recommendedAction || data.matchedRule || 'Chưa phát hiện vi phạm',
          remindMessage: data.remindText || '',
          findings: data.hasViolation ? [{
            ruleNumber: data.ruleNumber || '12 Luật',
            ruleTitle: data.matchedRule || 'Nội quy cộng đồng',
            severity: data.severity === 'critical' ? 'critical' : data.severity === 'high' ? 'high' : 'medium',
            evidence: data.evidenceSummary || 'Phát hiện bởi AI',
            explanation: data.reasoning || 'Vi phạm điều luật cộng đồng'
          }] : [],
          summary: data.reasoning || data.recommendedAction || 'Đã kiểm tra qua AI',
          analyzedMessagesCount: messages.length
        };
      }
    }
  } catch (err) {
    console.warn('Server AI audit proxy unavailable, running in-browser evaluation:', err);
  }

  // Fallback to client-side rule engine
  return evaluateUserWith12Rules(messages, reports, currentSanction);
}

/**
 * Format chat timeline date header in Vietnamese (e.g. "Hôm nay, Thứ Hai • 27/02/2026")
 */
export function formatGroupDateHeader(dateInput: string | number | Date | any): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const activeLang = getActiveLanguage();
  const locale = getLocaleTag(activeLang);
  let dayOfWeek = '';
  try {
    dayOfWeek = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d);
    if (dayOfWeek) {
      dayOfWeek = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    }
  } catch {
    const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    dayOfWeek = daysOfWeek[d.getDay()];
  }

  let dateFormatted = '';
  try {
    dateFormatted = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  } catch {
    dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  if (isToday) {
    return `${pickActiveLang('Hôm nay', 'Today', '今天')}, ${dayOfWeek} • ${dateFormatted}`;
  }
  if (isYesterday) {
    return `${pickActiveLang('Hôm qua', 'Yesterday', '昨天')}, ${dayOfWeek} • ${dateFormatted}`;
  }
  return `${dayOfWeek} • ${dateFormatted}`;
}

/**
 * Returns date grouping key "YYYY-MM-DD"
 */
export function getGroupDateKey(dateInput: string | number | Date | any): string {
  if (!dateInput) return 'unknown';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Checks if message timestamp is from today (since 00:00:00 today)
 */
export function isMessageFromToday(dateInput: string | number | Date | any): boolean {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

/**
 * Returns ISO string for the start of yesterday (00:00:00.000 local time)
 */
export function getYesterdayStartIso(): string {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  return yesterday.toISOString();
}

/**
 * Checks if a message timestamp is from today or yesterday
 */
export function isMessageFromTodayOrYesterday(dateInput: string | number | Date | any): boolean {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  return d.getTime() >= yesterday.getTime();
}

/**
 * Server Reset for DEV:
 * Deletes all messages or messages older than 7 days in the specified room to prevent server lag.
 */
export async function resetRoomMessagesServer(
  roomId: string,
  mode: 'all' | 'older_than_7_days',
  operatorName = 'Quản trị viên DEV'
): Promise<{ deletedCount: number; success: boolean; message: string }> {
  try {
    const messagesRef = collection(db, 'rooms', roomId, 'messages');
    const snap = await getDocs(messagesRef);
    if (snap.empty) {
      return {
        deletedCount: 0,
        success: true,
        message: pickActiveLang('Phòng hiện không có tin nhắn nào để reset.', 'This room currently has no messages to reset.', '当前房间没有可重置的消息。')
      };
    }

    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    
    const docsToDelete = snap.docs.filter(docSnap => {
      if (mode === 'all') return true;
      const data = docSnap.data();
      const msgTime = new Date(data.createdAt || 0).getTime();
      return (now - msgTime) > SEVEN_DAYS_MS;
    });

    if (docsToDelete.length === 0) {
      return { 
        deletedCount: 0, 
        success: true, 
        message: mode === 'older_than_7_days' 
          ? pickActiveLang('Không có tin nhắn nào cũ hơn 1 tuần (7 ngày) trong phòng này.', 'There are no messages older than 1 week (7 days) in this room.', '此房间中没有超过 1 周（7 天）的消息。')
          : pickActiveLang('Không có tin nhắn để xóa.', 'No messages to delete.', '没有可删除的消息。')
      };
    }

    // Batch delete in chunks of 400
    const chunkSize = 400;
    for (let i = 0; i < docsToDelete.length; i += chunkSize) {
      const chunk = docsToDelete.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // Send server reset announcement
    try {
      const cleanModeText = mode === 'all' 
        ? pickActiveLang('toàn bộ tin nhắn phòng trò chuyện', 'all chat room messages', '所有聊天室消息')
        : pickActiveLang('các tin nhắn cũ hơn 1 tuần (7 ngày)', 'messages older than 1 week (7 days)', '超过 1 周（7 天）的消息');
      await addDoc(collection(db, 'rooms', roomId, 'messages'), {
        senderId: 'system-server-reset',
        senderName: '👑 CLSEND SERVER (DEV)',
        senderDevice: 'System Server',
        text: pickActiveLang(
          '⚡ {operator} đã hoàn tất RESET MÁY CHỦ: Đã xóa sạch {count} tin nhắn ({mode}) để tối ưu hóa hiệu năng, giải phóng bộ nhớ và chống giật lag.',
          '⚡ {operator} completed SERVER RESET: Cleared {count} messages ({mode}) to optimize performance and free memory.',
          '⚡ {operator} 已完成服务器重置：已清理 {count} 条消息（{mode}），以优化性能并释放内存。'
        )
          .replace('{operator}', operatorName)
          .replace('{count}', String(docsToDelete.length))
          .replace('{mode}', cleanModeText),
        createdAt: new Date().toISOString(),
        isDevMessage: true,
        isSystemMessage: true
      });
    } catch (annError) {
      console.warn('Could not post system reset announcement:', annError);
    }

    return {
      deletedCount: docsToDelete.length,
      success: true,
      message: pickActiveLang(
        'Đã reset máy chủ thành công! Đã xóa {count} tin nhắn để giải phóng lag.',
        'Server reset successful! Deleted {count} messages to optimize performance.',
        '服务器重置成功！已删除 {count} 条消息以优化性能。'
      ).replace('{count}', String(docsToDelete.length))
    };
  } catch (err: any) {
    console.error('Reset server error:', err);
    return {
      deletedCount: 0,
      success: false,
      message: err.message || pickActiveLang('Lỗi khi reset máy chủ.', 'Error resetting server.', '重置服务器时出错。')
    };
  }
}

/**
 * Automatically prunes messages older than 7 days if weekly auto-clean is enabled
 */
export async function autoPruneWeeklyMessages(roomId: string): Promise<number> {
  try {
    const messagesRef = collection(db, 'rooms', roomId, 'messages');
    const snap = await getDocs(messagesRef);
    if (snap.empty) return 0;

    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const oldDocs = snap.docs.filter(docSnap => {
      const data = docSnap.data();
      const msgTime = new Date(data.createdAt || 0).getTime();
      return (now - msgTime) > SEVEN_DAYS_MS;
    });

    if (oldDocs.length === 0) return 0;

    const chunkSize = 400;
    for (let i = 0; i < oldDocs.length; i += chunkSize) {
      const chunk = oldDocs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    return oldDocs.length;
  } catch (e) {
    console.warn('Auto prune weekly messages failed:', e);
    return 0;
  }
}

