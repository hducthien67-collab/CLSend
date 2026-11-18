import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage, pickLang, getLocaleTag } from '../context/LanguageContext';
import { db } from '../firebase/config';
import { doc, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { UserSanction } from './types';
import { getEmailSanctionDocId, getPhoneSanctionDocId, isRealEmail } from '../utils/devModeration';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Ban, 
  Clock, 
  Check, 
  LogOut, 
  Scale, 
  ExternalLink,
  MessageSquare,
  FileText,
  AlertOctagon,
  Quote
} from 'lucide-react';

interface RobloxModerationModalProps {
  onOpenRules?: () => void;
}

export const RobloxModerationModal: React.FC<RobloxModerationModalProps> = ({ onOpenRules }) => {
  const { currentUser, logout } = useAuth();
  const { currentLang } = useLanguage();
  const pick = (vi: string, en: string, zh: string) => pickLang(currentLang, vi, en, zh);
  const [activeSanction, setActiveSanction] = useState<UserSanction | null>(null);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealStatus, setAppealStatus] = useState<string | null>(null);

  const handleSubmitAppeal = async () => {
    if (!appealReason.trim() || !currentUser) return;
    try {
      await addDoc(collection(db, 'reports'), {
        type: 'account_appeal',
        status: 'pending',
        senderId: currentUser.uid,
        senderName: currentUser.displayName || offenderName,
        senderEmail: currentUser.email || offenderEmail,
        reason: appealReason.trim(),
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      });
      setAppealStatus(pick('Kháng cáo của bạn đã được gửi thành công tới tab Báo Cáo trong DataStore.', 'Your appeal has been submitted to the Reports queue.', '您的申诉已成功提交至审核报告列表。'));
      setTimeout(() => {
        setIsAppealModalOpen(false);
        setAppealReason('');
        setAppealStatus(null);
      }, 3000);
    } catch (err) {
      console.error('Submit appeal error:', err);
      setAppealStatus(pick('Lỗi khi gửi kháng cáo lên hệ thống.', 'Error submitting appeal to the system.', '向系统提交申诉时出错。'));
    }
  };

  // Subscribe to real-time sanction record for current user (uid, real email, linkedEmail, linked phone, linkedUids)
  useEffect(() => {
    if (!currentUser) {
      setActiveSanction(null);
      return;
    }

    const docIds = new Set<string>();
    if (currentUser.uid) docIds.add(currentUser.uid);
    if (isRealEmail(currentUser.email)) docIds.add(getEmailSanctionDocId(currentUser.email!));
    if (isRealEmail(currentUser.linkedEmail)) docIds.add(getEmailSanctionDocId(currentUser.linkedEmail!));
    const phoneId = getPhoneSanctionDocId(currentUser.phone || currentUser.linkedPhone || '');
    if (phoneId) docIds.add(phoneId);
    (currentUser.linkedUids || []).forEach((u) => {
      if (u && u.trim()) docIds.add(u.trim());
    });

    const docSanctions = new Map<string, UserSanction>();

    const handleSanctionUpdate = (data: UserSanction) => {
      const now = Date.now();

      // Check if ban is still active
      if (data.isBanned) {
        if (data.banExpiresAt) {
          const exp = new Date(data.banExpiresAt).getTime();
          if (now > exp) {
            setActiveSanction(null);
            return;
          }
        }
        setActiveSanction(data);
        return;
      }

      // Check if chat lock is active and hasn't been acknowledged in this session
      if (data.isChatLocked) {
        if (data.chatLockExpiresAt) {
          const exp = new Date(data.chatLockExpiresAt).getTime();
          if (now > exp) {
            setActiveSanction(null);
            return;
          }
        }

        const ackKey = `cloudsend_ack_sanction_${data.uid}_${data.lastSanctionType}_${data.violationCount}`;
        const isAcked = localStorage.getItem(ackKey) === 'true';
        if (!isAcked) {
          setActiveSanction(data);
        } else {
          setActiveSanction(null);
        }
        return;
      }

      setActiveSanction(null);
    };

    const reevaluate = () => {
      // Prefer active ban over chat lock
      let chosen: UserSanction | null = null;
      for (const s of docSanctions.values()) {
        if (s.isBanned) {
          chosen = s;
          break;
        }
        if (!chosen) chosen = s;
      }
      if (!chosen) {
        setActiveSanction(null);
        return;
      }
      handleSanctionUpdate(chosen);
    };

    const unsubs = Array.from(docIds).map((docId) =>
      onSnapshot(
        doc(db, 'sanctions', docId),
        (snap) => {
          if (snap.exists()) {
            docSanctions.set(docId, snap.data() as UserSanction);
          } else {
            docSanctions.delete(docId);
          }
          reevaluate();
        },
        (err) => {
          console.warn('Error listening to sanction doc:', docId, err);
        }
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [currentUser]);

  // Lock body & container scroll when moderation modal is open
  useEffect(() => {
    if (activeSanction) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');

      const preventBackgroundScroll = (e: Event) => {
        const target = e.target as HTMLElement | null;
        if (target && (target.closest('#roblox-moderation-modal') || target.closest('.scrollbar-thin'))) {
          return;
        }
        e.preventDefault();
      };

      window.addEventListener('wheel', preventBackgroundScroll, { passive: false });
      window.addEventListener('touchmove', preventBackgroundScroll, { passive: false });

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.classList.remove('modal-open');
        window.removeEventListener('wheel', preventBackgroundScroll);
        window.removeEventListener('touchmove', preventBackgroundScroll);
      };
    }
  }, [activeSanction]);

  // Live countdown timer for temporary bans / chat locks
  useEffect(() => {
    if (!activeSanction) return;

    const targetExpiry = activeSanction.banExpiresAt || activeSanction.chatLockExpiresAt;
    if (!targetExpiry) {
      if (activeSanction.isBanned && !activeSanction.banExpiresAt) {
        setTimeLeft(pick('Vĩnh viễn (Permanent)', 'Permanent', '永久'));
      } else {
        setTimeLeft('');
      }
      return;
    }

    const updateTimer = () => {
      const diff = new Date(targetExpiry).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft(pick('Đã hết hạn kỷ luật', 'Sanction expired', '处罚已到期'));
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      const dUnit = pick('ngày', 'd', '天');
      const hUnit = pick('giờ', 'h', '小时');
      const mUnit = pick('phút', 'm', '分钟');
      const sUnit = pick('giây', 's', '秒');

      if (days > 0) {
        setTimeLeft(`${days} ${dUnit} ${hours} ${hUnit} ${minutes} ${mUnit}`);
      } else if (hours > 0) {
        setTimeLeft(`${hours} ${hUnit} ${minutes} ${mUnit} ${seconds} ${sUnit}`);
      } else {
        setTimeLeft(`${minutes} ${mUnit} ${seconds} ${sUnit}`);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeSanction, currentLang]);

  if (!activeSanction) return null;

  const isBanned = Boolean(activeSanction.isBanned);
  const tierType = activeSanction.lastSanctionType;

  // Roblox title mapping matching the exact 5 tiers
  const getRobloxHeaderTitle = () => {
    switch (tierType as string) {
      case 'level_1':
      case 'warn':
        return pick('Cảnh Báo (Warning)', 'Warning', '警告');
      case 'level_2':
      case 'chat_lock_1h':
        return pick('Tạm Khóa Chat 1 Tiếng', 'Chat Suspended for 1 Hour', '禁言 1 小时');
      case 'chat_lock_15m':
        return pick('Tạm Khóa Chat 15 Phút', 'Chat Suspended for 15 Minutes', '禁言 15 分钟');
      case 'level_3':
      case 'ban_1d':
        return pick('Khóa Tài Khoản 1 Ngày', 'Banned for 1 Day', '封禁账号 1 天');
      case 'ban_3d':
        return pick('Khóa Tài Khoản 3 Ngày', 'Banned for 3 Days', '封禁账号 3 天');
      case 'level_4':
      case 'ban_7d':
        return pick('Khóa Tài Khoản 7 Ngày', 'Banned for 7 Days', '封禁账号 7 天');
      case 'ban_6m':
        return pick('Khóa Tài Khoản 6 Tháng', 'Banned for 6 Months', '封禁账号 6 个月');
      case 'level_perm':
      case 'ban_perm':
      default:
        return pick('Tài Khoản Đã Bị Xóa Vĩnh Viễn', 'Account Deleted / Terminated', '账号已被永久封禁');
    }
  };

  const handleAcknowledgeAndContinue = () => {
    if (!agreedTerms && !isBanned) return;
    
    if (activeSanction) {
      const ackKey = `cloudsend_ack_sanction_${activeSanction.uid}_${activeSanction.lastSanctionType}_${activeSanction.violationCount}`;
      localStorage.setItem(ackKey, 'true');
    }
    setActiveSanction(null);
  };

  const localeTag = getLocaleTag(currentLang);
  const rawDate = activeSanction.bannedAt || (activeSanction.history && activeSanction.history[0]?.timestamp);
  const formattedReviewedDate = rawDate 
    ? new Date(rawDate).toLocaleString(localeTag, { dateStyle: 'medium', timeStyle: 'medium' })
    : new Date().toLocaleString(localeTag, { dateStyle: 'medium', timeStyle: 'medium' });

  // Latest offensive items & notes from history or sanction record
  const latestHistory = activeSanction.history?.[0];
  const offensiveReason = activeSanction.reason || latestHistory?.reason || pick('Ngôn từ không phù hợp hoặc vi phạm nội quy tiêu chuẩn cộng đồng', 'Inappropriate language or violation of Community Guidelines', '不当言论或违反社区规范');
  const moderatorNote = activeSanction.remindText || latestHistory?.remindText || pick('Hệ thống an toàn ghi nhận lời nói của bạn chưa phù hợp với Tiêu chuẩn Cộng đồng. Hãy giữ thái độ lịch sự, văn minh và tôn trọng mọi người.', 'Our safety system detected content violating Community Guidelines. Please keep your interactions respectful and polite.', '安全系统检测到您的言行不符合社区规范。请保持礼貌、文明并尊重他人。');
  const ruleViolated = activeSanction.ruleViolated || latestHistory?.ruleViolated || pick('Tiêu Chuẩn & Nội Quy Cộng Đồng ClSend', 'ClSend Community Guidelines & Terms', 'ClSend 社区规范与使用条款');
  const offensiveItem = activeSanction.offensiveItem || latestHistory?.offensiveItem || '';
  const offensiveTime = activeSanction.offensiveItemTimestamp || latestHistory?.timestamp || rawDate;
  const offenderName = activeSanction.displayName || activeSanction.senderName || latestHistory?.senderName || activeSanction.email || pick('Người dùng', 'User', '用户');
  const offenderEmail = activeSanction.email || activeSanction.senderEmail || '';
  const actedBy = activeSanction.actedBy || latestHistory?.actedBy || pick('Đội Ngũ Kiểm Duyệt & An Toàn ClSend', 'ClSend Moderation & Safety Team', 'ClSend 审核与安全团队');

  const formattedOffensiveTime = offensiveTime
    ? new Date(offensiveTime).toLocaleString(localeTag, { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      })
    : formattedReviewedDate;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-[2px] animate-in fade-in duration-150 select-text overflow-y-auto">
      {/* Main Roblox-Style Notice Box - Compact & Sleek */}
      <div 
        id="roblox-moderation-modal"
        className="w-full max-w-md bg-slate-900 border-2 border-slate-700/90 rounded-2xl shadow-2xl shadow-black overflow-hidden flex flex-col relative z-10 my-auto animate-in zoom-in-95 duration-150"
      >
        {/* Roblox Header Ribbon */}
        <div className={`px-4 py-3 border-b flex items-center justify-between ${
          isBanned ? 'bg-rose-950/80 border-rose-500/50 text-rose-200' : 'bg-amber-950/70 border-amber-500/50 text-amber-200'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 ${
              isBanned ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-inner' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-inner'
            }`}>
              {isBanned ? <Ban className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-700 text-slate-300 font-mono">
                  ClSend Moderation
                </span>
                {activeSanction.violationCount > 1 && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/30 border border-rose-500 text-rose-200 font-mono">
                    {pick('Lần {n}', 'Violation #{n}', '第 {n} 次').replace('{n}', String(activeSanction.violationCount))}
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white uppercase font-sans mt-0.5 truncate">
                {getRobloxHeaderTitle()}
              </h2>
            </div>
          </div>

          <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-slate-950/90 border border-slate-700 text-slate-200 shrink-0">
            {activeSanction.severityLevel?.toUpperCase() || 'VIOLATION'}
          </span>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3 text-xs text-slate-200 leading-relaxed overflow-y-auto max-h-[65vh] scrollbar-thin scrollbar-thumb-slate-700 overscroll-contain">
          
          {/* Main Statement */}
          <div className="space-y-1.5 border-b border-slate-800 pb-3">
            <p className="text-slate-300 text-xs">
              {pick('Hệ thống an toàn ghi nhận tài khoản trên ClSend đã vi phạm Tiêu chuẩn Cộng đồng.', 'Our safety system detected that this ClSend account violated Community Guidelines.', '安全系统检测到此 ClSend 账号违反了社区规范。')}
            </p>
            
            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between flex-wrap gap-1.5 pt-0.5">
              <span>{pick('Đã xem xét:', 'Reviewed:', '审核时间：')} <strong className="text-slate-200">{formattedReviewedDate}</strong></span>
              {ruleViolated && (
                <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30 text-[10px]">
                  {ruleViolated}
                </span>
              )}
            </div>

            {timeLeft && (
              <div className="text-[11px] text-rose-300 font-bold flex items-center gap-1 pt-1">
                <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{pick('Thời hạn hiệu lực:', 'Effective duration:', '有效时长：')} <strong className="text-white font-mono bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/40">{timeLeft}</strong></span>
              </div>
            )}
          </div>

          {/* 1. THÔNG TIN TÀI KHOẢN BỊ KỶ LUẬT */}
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-sky-400" />
              <span>{pick('Tài khoản & Thiết bị vi phạm:', 'Violating Account & Device:', '违规账号与设备：')}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px]">
              <div className="text-[9px] text-slate-400 uppercase font-mono">{pick('Tên tài khoản / Biệt danh:', 'Username / Display Name:', '用户名 / 昵称：')}</div>
              <div className="text-white font-bold truncate mt-0.5">{offenderName}</div>
              {offenderEmail && <div className="text-[9px] text-slate-500 truncate font-mono mt-0.5">Email: {offenderEmail}</div>}
            </div>
          </div>

          {/* 2. NỘI DUNG VI PHẠM & THỜI GIAN */}
          <div className="p-3 rounded-xl bg-slate-950/90 border border-rose-500/30 space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                <Quote className="w-3 h-3 text-rose-400" />
                <span>{pick('Nội dung vi phạm:', 'Offensive Item:', '违规内容：')}</span>
              </div>
              <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                <Clock className="w-2.5 h-2.5 text-amber-400" />
                <span>{pick('Thời gian:', 'Time:', '时间：')} <strong className="text-slate-200">{formattedOffensiveTime}</strong></span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-rose-500/40 text-rose-200 font-mono text-xs break-words whitespace-pre-wrap leading-relaxed shadow-inner">
              {offensiveItem ? offensiveItem : `"${offensiveReason}"`}
            </div>
          </div>

          {/* Moderator Note Section */}
          <div className="p-3 rounded-xl bg-[#030814] border border-cyan-900/50 space-y-1.5 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-cyan-400" />
              <span>{pick('Ghi chú của Người Kiểm Duyệt (Moderator Note):', 'Moderator Note:', '审核员备注：')}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#020712] border border-[#1e3a5f] text-cyan-300 italic text-xs font-sans tracking-wide shadow-inner break-words whitespace-pre-wrap leading-relaxed">
              {moderatorNote}
            </div>
          </div>

          {/* Reason Section */}
          <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3 h-3 text-rose-400" />
              <span>{pick('Lý do kỷ luật (Reason):', 'Reason:', '处罚原因：')}</span>
            </div>
            <div className="text-xs text-white font-semibold break-words">
              {offensiveReason}
            </div>
          </div>

          {/* Interactive acknowledgement checkbox for warning / chat lock */}
          {!isBanned && (
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500 mt-0.5 shrink-0 cursor-pointer"
              />
              <span className="text-[11px] text-slate-300 font-medium select-none">
                {pick('Tôi đồng ý tuân thủ Nội quy và Tiêu chuẩn Cộng đồng ClSend.', 'I agree to comply with ClSend Community Guidelines and Terms.', '我同意遵守 ClSend 社区规范与使用条款。')}
              </span>
            </label>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-2">
          {onOpenRules ? (
            <button
              type="button"
              onClick={onOpenRules}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Scale className="w-3 h-3" />
              <span>{pick('12 Điều Luật', '12 Community Rules', '12 条社区规范')}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {isBanned ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAppealModalOpen(true)}
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-sky-600/30 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{pick('Kháng Cáo', 'Appeal', '申诉')}</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{pick('Đăng Xuất', 'Log Out', '退出登录')}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!agreedTerms}
                onClick={handleAcknowledgeAndContinue}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{pick('Tiếp Tục', 'Continue', '继续')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Appeal Modal Dialog */}
      {isAppealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span>{pick('Gửi Kháng Cáo Tài Khoản Bị Cấm', 'Submit Account Ban Appeal', '提交账号封禁申诉')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAppealModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {appealStatus ? (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold text-center">
                {appealStatus}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-300">
                  {pick(
                    'Nhập lý do hoặc lời giải thích của bạn để Quản Trị Viên xem xét và mở khóa tài khoản:',
                    'Enter your reason or explanation for Administrators to review and unlock your account:',
                    '请输入您的申诉理由或说明，以便管理员核查并考虑解封您的账号：'
                  )}
                </p>
                <textarea
                  rows={4}
                  placeholder={pick('Nhập lý do kháng cáo của bạn ở đây...', 'Enter your appeal reason here...', '请在此输入您的申诉理由...')}
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500 resize-none"
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAppealModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
                  >
                    {pick('Hủy', 'Cancel', '取消')}
                  </button>
                  <button
                    type="button"
                    disabled={!appealReason.trim()}
                    onClick={handleSubmitAppeal}
                    className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-sky-950/40"
                  >
                    {pick('Gửi Kháng Cáo Ngay', 'Submit Appeal Now', '立即提交申诉')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
