import React, { useState } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import { 
  Flag, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert,
  Send,
  MessageSquare
} from 'lucide-react';
import { useLanguage, pickLang } from '../context/LanguageContext';

interface ReportIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  currentUserId: string;
  currentUserName: string;
}

export const ReportIncidentModal: React.FC<ReportIncidentModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomName,
  currentUserId,
  currentUserName
}) => {
  const { currentLang } = useLanguage();
  const isVi = currentLang === 'vi';
  const isZh = currentLang === 'zh-CN' || currentLang === 'zh-TW';
  const isEn = !isVi && !isZh;
  const pick = <T,>(vi: T, en: T, zh: T): T => pickLang(currentLang, vi, en, zh);

  const [category, setCategory] = useState<'profanity_bypass' | 'nsfw_18' | 'harassment' | 'spam' | 'impersonation' | 'other'>('profanity_bypass');
  const [targetMember, setTargetMember] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const categories = isEn ? [
    {
      id: 'profanity_bypass',
      title: 'Profanity Filter Bypass / Personal Insults',
      desc: 'Using symbols, dots, or disguised slang to curse or insult users'
    },
    {
      id: 'nsfw_18',
      title: 'Explicit 18+ or Pornographic Media',
      desc: 'Sending explicit images, adult videos, or inappropriate content'
    },
    {
      id: 'harassment',
      title: 'Harassment / Threats / Hate Speech',
      desc: 'Bullying, intimidating, or discriminating against room members'
    },
    {
      id: 'spam',
      title: 'Spamming / Flooding / Bandwidth Abuse',
      desc: 'Rapidly blasting identical messages or overloading the room'
    },
    {
      id: 'impersonation',
      title: 'Admin / Developer Impersonation & Scams',
      desc: 'Claiming to be staff or asking for personal credentials'
    },
    {
      id: 'other',
      title: 'Other Community Violations',
      desc: 'Any behavior that disrupts the chat experience'
    }
  ] : isZh ? [
    {
      id: 'profanity_bypass',
      title: '绕过脏话过滤 / 人身侮辱',
      desc: '使用特殊符号、句号或谐音伪装粗俗辱骂他人'
    },
    {
      id: 'nsfw_18',
      title: '18+ 成人色情或低俗内容',
      desc: '发送不雅露骨图片、成人视频或低俗诱导文字'
    },
    {
      id: 'harassment',
      title: '骚扰 / 威胁 / 恶意攻击',
      desc: '存在霸凌、恐吓、地域/群体歧视或干扰他人行为'
    },
    {
      id: 'spam',
      title: '刷屏骚扰 / 破坏聊天室秩序',
      desc: '连续刷屏、使用脚本恶意捣乱或拥堵传输通道'
    },
    {
      id: 'impersonation',
      title: '冒充管理员 (Admin/Dev) 及诈骗',
      desc: '假冒开发人员或管理团队索要 PIN 码或实施欺诈'
    },
    {
      id: 'other',
      title: '其他违规行为',
      desc: '任何影响聊天室安全与良好氛围的不当行为'
    }
  ] : [
    {
      id: 'profanity_bypass',
      title: 'Lách luật chửi bậy / Xúc phạm danh dự',
      desc: 'Dùng ký tự đặc biệt, dấu chấm hoặc từ ngữ lách luật để thô tục, hạ nhục'
    },
    {
      id: 'nsfw_18',
      title: 'Nội dung hoặc ảnh 18+ khiêu dâm',
      desc: 'Hình ảnh, video hoặc văn bản gợi dục, đồi trụy không phù hợp'
    },
    {
      id: 'harassment',
      title: 'Quấy rối / Đe dọa / Công kích',
      desc: 'Có hành vi bắt nạt, đe dọa, kỳ thị hoặc quấy phá thành viên khác'
    },
    {
      id: 'spam',
      title: 'Spam tin nhắn / Phá hoại phòng chat',
      desc: 'Gửi dồn dập, dùng script phá rối hoặc làm nghẽn kênh truyền'
    },
    {
      id: 'impersonation',
      title: 'Mạo danh Admin (Quản trị viên) & Lừa đảo',
      desc: 'Giả danh lập trình viên, ban quản trị để đòi mã PIN hoặc lừa đảo'
    },
    {
      id: 'other',
      title: 'Hành vi vi phạm khác',
      desc: 'Bất kỳ hành vi không lành mạnh nào ảnh hưởng đến an toàn phòng chat'
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const selectedCategoryObj = categories.find(c => c.id === category);
      const categoryTitle = selectedCategoryObj ? selectedCategoryObj.title : pick('Vi phạm quy tắc', 'Rule Violation', '违反规则');

      await addDoc(collection(db, 'reports'), {
        roomId,
        roomName,
        targetMember: targetMember.trim() || pick('Toàn phòng', 'Room General', '整个房间'),
        reportedByUid: currentUserId,
        reportedByName: currentUserName,
        category,
        categoryTitle,
        details: details.trim(),
        status: 'pending',
        type: 'room_report',
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setDetails('');
        setTargetMember('');
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Submit report error:', err);
      alert(pick('Không thể gửi báo cáo, vui lòng thử lại sau.', 'Failed to submit report. Please try again.', '无法提交举报，请稍后重试。'));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl relative text-slate-100 overflow-hidden space-y-4">
        
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 shadow-md">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {pick('Báo Cáo Vi Phạm Tới DEV / Admin', 'Report Violation to DEV / Admin', '向开发者 / 管理员举报违规')}
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">
                {pick(`Phòng: ${roomName}`, `Room: ${roomName}`, `房间：${roomName}`)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            title={pick('Đóng', 'Close', '关闭')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-white">
              {pick('Đã Gửi Báo Cáo Thành Công!', 'Report Submitted Successfully!', '举报提交成功！')}
            </h4>
            <p className="text-xs text-slate-300 max-w-xs mx-auto">
              {pick(
                'Cảm ơn bạn đã giữ gìn môi trường văn minh trên CloudSend. Đội ngũ DEV sẽ kiểm tra và áp dụng chế tài sớm nhất.',
                'Thank you for keeping CloudSend safe. The DEV / Moderation team will inspect and take action shortly.',
                '感谢您维护 CloudSend 的安全与文明环境。开发与管理团队将尽快核查并处理。'
              )}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Target Member (Optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                {pick('Thành viên vi phạm (không bắt buộc):', 'Member committing violation (optional):', '违规成员（可选）：')}
              </label>
              <input
                type="text"
                value={targetMember}
                onChange={(e) => setTargetMember(e.target.value)}
                placeholder={pick('Ví dụ: Tên hiển thị hoặc tên máy thành viên...', 'Enter username or device name...', '输入成员昵称或设备名...')}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-rose-500/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Violation Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                {pick('Hành vi vi phạm:', 'Violation Category:', '违规类别：')}
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(100,116,139,0.5)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb]:rounded-full">
                {categories.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      category === c.id
                        ? 'bg-rose-500/10 border-rose-500/50 text-rose-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report_incident_category"
                      checked={category === c.id}
                      onChange={() => setCategory(c.id as any)}
                      className="mt-0.5 text-rose-500 focus:ring-rose-500 accent-rose-500 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white">{c.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{c.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Details Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                {pick('Chi tiết bổ sung / Mô tả tình huống:', 'Additional details / Evidence explanation:', '补充详情 / 情况说明：')}
              </label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={pick(
                  'Mô tả chi tiết vi phạm (ví dụ: thành viên cố tình spam, dùng từ ngữ khiêu khích, chia sẻ liên kết xấu)...',
                  'Describe what happened (e.g. offensive language, repeated spam, inappropriate files)...',
                  '请详细描述违规情况（例如：恶意刷屏、使用侮辱性言语、发送不雅内容或恶意链接）...'
                )}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-rose-500/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none resize-none transition-colors [scrollbar-width:thin] [scrollbar-color:rgba(100,116,139,0.5)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb]:rounded-full"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {pick('Hủy', 'Cancel', '取消')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                {submitting ? (
                  <span>{pick('Đang gửi...', 'Sending...', '正在提交...')}</span>
                ) : (
                  <>
                    <Flag className="w-3.5 h-3.5" />
                    <span>{pick('Gửi Báo Cáo', 'Submit Report', '提交举报')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
