import React, { useState } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import { ChatMessage } from './types';
import { Flag, X, CheckCircle2 } from 'lucide-react';
import { useLanguage, pickLang } from '../context/LanguageContext';

interface ReportMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  roomId: string;
  roomName: string;
  currentUserId: string;
  currentUserName: string;
}

export const ReportMessageModal: React.FC<ReportMessageModalProps> = ({
  isOpen,
  onClose,
  message,
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

  const [category, setCategory] = useState<'profanity_bypass' | 'nsfw_18' | 'harassment' | 'spam' | 'other'>('profanity_bypass');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !message) return null;

  const categories = [
    {
      id: 'profanity_bypass',
      title: pick('Lách luật chửi bậy / Xúc phạm', 'Profanity Filter Bypass / Personal Insults', '绕过脏话过滤 / 侮辱他人'),
      desc: pick('Dùng ký tự đặc biệt, dấu chấm hoặc từ ngữ né tránh để thô tục, lăng mạ', 'Using symbols, dots, or disguised slang to curse or insult users', '使用特殊符号、句号或谐音伪装粗俗辱骂他人')
    },
    {
      id: 'nsfw_18',
      title: pick('Nội dung hoặc ảnh 18+ khiêu dâm', 'Explicit 18+ or Pornographic Media', '18+ 成人色情或低俗内容'),
      desc: pick('Hình ảnh, video hoặc văn bản gợi dục, đồi trụy không phù hợp', 'Images, videos, or text containing explicit adult material', '包含不雅露骨内容、成人图片、视频或低俗诱导文字')
    },
    {
      id: 'harassment',
      title: pick('Quấy rối / Đe dọa / Công kích', 'Harassment / Threats / Cyberbullying', '骚扰 / 威胁 / 人身攻击'),
      desc: pick('Có hành vi bắt nạt, đe dọa hoặc làm phiền thành viên khác', 'Bullying, intimidating, or bothering other members', '存在霸凌、恐吓或持续干扰其他成员的行为')
    },
    {
      id: 'spam',
      title: pick('Spam / Lừa đảo / Quảng cáo', 'Spam / Scam / Phishing Ads', '刷屏 / 诈骗 / 垃圾广告'),
      desc: pick('Gửi dồn dập, chia sẻ liên kết độc hại, quảng cáo rác', 'Flooding messages, malicious links, or unwanted promotions', '高频发送垃圾消息、分享恶意钓鱼链接或推销广告')
    },
    {
      id: 'other',
      title: pick('Hành vi vi phạm khác', 'Other Community Violations', '其他违规行为'),
      desc: pick('Bất kỳ hành vi không lành mạnh nào ảnh hưởng đến phòng chat', 'Any inappropriate behavior disrupting the chat experience', '任何影响聊天室安全与正常体验的不良行为')
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const selectedCategoryObj = categories.find(c => c.id === category);
      const categoryTitle = selectedCategoryObj ? selectedCategoryObj.title : pick('Vi phạm quy tắc', 'Rule Violation', '违反规则');
      const finalReason = details.trim() 
        ? `${categoryTitle} - ${details.trim()}`
        : categoryTitle;

      await addDoc(collection(db, 'reports'), {
        roomId,
        roomName,
        messageId: message.id,
        messageText: message.text || '',
        messageRawText: message.rawText || message.text || '',
        senderId: message.senderId,
        senderName: message.senderName,
        senderDevice: message.senderDevice || '',
        reportedByUid: currentUserId,
        reportedByName: currentUserName,
        reason: finalReason,
        category,
        categoryTitle,
        status: 'pending',
        type: 'message_report',
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setDetails('');
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Submit report error:', err);
      setErrorMsg(pick('Không thể gửi báo cáo, vui lòng thử lại sau.', 'Failed to submit report. Please try again.', '无法提交举报，请稍后重试。'));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5 text-rose-400">
            <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <Flag className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                {pick('Tố Cáo Vi Phạm Đến DEV', 'Report Violation to DEV', '向开发者举报违规消息')}
              </h3>
              <p className="text-xs text-slate-400">
                {pick('Báo cáo tin nhắn lách luật hoặc có nội dung xấu', 'Report message bypassing rules or containing toxic content', '举报规避审查或包含有害内容的消息')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={pick('Đóng', 'Close', '关闭')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-white">
              {pick('Đã Gửi Báo Cáo Thành Công!', 'Report Submitted Successfully!', '举报提交成功！')}
            </h4>
            <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
              {pick(
                'Cảm ơn bạn đã tố cáo. Nhà phát triển (DEV) sẽ căn cứ vào báo cáo này trong DataStore để kiểm tra nội dung gốc và xử phạt người vi phạm.',
                'Thank you for reporting. The developer (DEV) will review this report in the DataStore to inspect original logs and enforce sanctions.',
                '感谢您的举报。开发者 (DEV) 将在 DataStore 中核查此举报记录及原始内容，并对违规者采取相应处罚。'
              )}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Target message snippet */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-200">
                  {`${pick('Người gửi:', 'Sender:', '发送者：')} ${message.senderName}`}
                </span>
                <span className="text-[11px] text-slate-500">{message.senderDevice}</span>
              </div>
              <p className="text-sm text-slate-300 italic line-clamp-3 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                "{message.rawText || message.text || pick('[Tệp tin đính kèm]', '[Attachment file]', '[附件文件]')}"
              </p>
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                {pick('CHỌN LÝ DO TỐ CÁO:', 'CHOOSE REPORT REASON:', '选择举报原因：')}
              </label>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <label
                    key={cat.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      category === cat.id
                        ? 'bg-rose-500/10 border-rose-500/60 text-white shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-category"
                      value={cat.id}
                      checked={category === cat.id}
                      onChange={() => setCategory(cat.id as any)}
                      className="mt-0.5 text-rose-500 focus:ring-rose-500 accent-rose-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-100">{cat.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{cat.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                {pick('GHI CHÚ THÊM CHO DEV (TÙY CHỌN):', 'ADDITIONAL NOTES FOR DEV (OPTIONAL):', '给开发者的补充备注（可选）：')}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={pick(
                  'Ví dụ: Người này liên tục chửi bậy bằng cách chèn dấu chấm để lách lọc...',
                  'E.g.: This user is spamming profanities with dots to bypass the filter...',
                  '例如：该用户持续通过插入符号绕过过滤并辱骂他人...'
                )}
                rows={2}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors resize-none"
              />
            </div>

            {errorMsg && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {pick('Hủy', 'Cancel', '取消')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-950/50 disabled:opacity-50 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>
                  {submitting 
                    ? pick('Đang gửi...', 'Sending...', '正在发送...') 
                    : pick('Gửi Tố Cáo Đến DEV', 'Submit Report to DEV', '向 DEV 提交举报')}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
