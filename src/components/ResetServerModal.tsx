import React, { useState } from 'react';
import { Crown, Zap, Server, Trash2, Calendar, Check, AlertTriangle, X, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { resetRoomMessagesServer } from '../utils/devModeration';
import { useLanguage, pickLang } from '../context/LanguageContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

interface ResetServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  totalMessagesCount?: number;
  isAutoWeeklyEnabled?: boolean;
  onResetSuccess?: () => void;
}

export const ResetServerModal: React.FC<ResetServerModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomName,
  totalMessagesCount = 0,
  isAutoWeeklyEnabled = false,
  onResetSuccess
}) => {
  const { currentLang } = useLanguage();
  const pick = (vi: string, en: string, zh: string) => pickLang(currentLang, vi, en, zh);
  const [selectedMode, setSelectedMode] = useState<'all' | 'older_than_7_days'>('older_than_7_days');
  const [autoWeekly, setAutoWeekly] = useState(isAutoWeeklyEnabled);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleExecuteReset = async () => {
    setIsProcessing(true);
    setResultMessage(null);

    try {
      // 1. If autoWeekly changed, persist to room doc
      if (roomId && roomId !== 'public-relay-lounge') {
        try {
          await updateDoc(doc(db, 'rooms', roomId), {
            autoWeeklyReset: autoWeekly
          });
        } catch (e) {
          console.warn('Could not update autoWeeklyReset flag on room:', e);
        }
      }

      // 2. Execute server messages reset
      const result = await resetRoomMessagesServer(roomId, selectedMode, pick('DEV Quản Trị Viên', 'DEV Administrator', 'DEV 管理员'));
      if (result.success) {
        setResultMessage({
          type: 'success',
          text: result.message
        });
        if (onResetSuccess) {
          onResetSuccess();
        }
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setResultMessage({
          type: 'error',
          text: result.message
        });
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: err.message || pick('Lỗi không xác định khi reset máy chủ.', 'Unknown error while resetting server.', '重置服务器时发生未知错误。')
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 sm:p-5 w-full max-w-md shadow-2xl shadow-amber-500/10 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-extrabold text-white">{pick('Reset Máy Chủ Trò Chuyện', 'Reset Chat Server', '重置聊天服务器')}</h3>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5">
                  <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  DEV
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {pick('Phòng:', 'Room:', '房间：')} <span className="text-emerald-400 font-semibold">{roomName}</span> ({pick('{n} tin nhắn', '{n} messages', '{n} 条消息').replace('{n}', String(totalMessagesCount))})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Explain info */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <Server className="w-3.5 h-3.5" />
            <span>{pick('Tối ưu hóa máy chủ & Chống lag (Anti-Lag Engine)', 'Server Optimization & Anti-Lag Engine', '服务器优化与防卡顿引擎')}</span>
          </div>
          <p className="text-[11px] text-amber-200/80 leading-relaxed">
            {pick(
              'Tin nhắn dồn ứ qua nhiều tuần sẽ làm máy chủ Firestore bị quá tải và gây giật lag khi tải chat. Bạn có thể chọn reset dọn dẹp các tin nhắn cũ để giải phóng máy chủ ngay lập tức.',
              'Accumulated messages over multiple weeks can overload the database and cause lag when loading chats. You can clean up old messages to optimize server performance immediately.',
              '数周积累的消息会加重数据库负载并导致加载聊天卡顿。您可以清理旧消息以立即释放服务器性能。'
            )}
          </p>
        </div>

        {/* Mode Selector */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            {pick('Chọn phương thức Reset:', 'Select Reset Method:', '选择重置方式：')}
          </label>

          {/* Option 1: Clean > 7 days */}
          <div
            onClick={() => setSelectedMode('older_than_7_days')}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              selectedMode === 'older_than_7_days'
                ? 'bg-amber-500/15 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${selectedMode === 'older_than_7_days' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{pick('Dọn tin nhắn cũ hơn 1 tuần (7 ngày)', 'Clear messages older than 1 week (7 days)', '清理超过 1 周（7 天）的旧消息')}</span>
                <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 bg-emerald-500/10 rounded">
                  {pick('Khuyên dùng', 'Recommended', '推荐')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                {pick(
                  'Xóa các tin nhắn cũ hơn 7 ngày để giải phóng lag, đồng thời giữ lại các tin nhắn mới trong tuần gần nhất.',
                  'Delete messages older than 7 days to reduce lag while keeping messages from the past week.',
                  '删除 7 天前的消息以消除卡顿，同时保留最近一周的新消息。'
                )}
              </p>
            </div>
          </div>

          {/* Option 2: Full Purge */}
          <div
            onClick={() => setSelectedMode('all')}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              selectedMode === 'all'
                ? 'bg-rose-500/15 border-rose-500/60 shadow-md ring-1 ring-rose-500/30'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${selectedMode === 'all' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-200">{pick('Reset Toàn Bộ (Xóa sạch tin nhắn phòng)', 'Full Reset (Purge all room messages)', '全部重置（清空房间所有消息）')}</span>
                <span className="text-[10px] text-rose-400 font-mono font-bold px-1.5 py-0.5 bg-rose-500/10 rounded">
                  {pick('100% Sạch', '100% Clean', '100% 清空')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                {pick(
                  'Xóa sạch toàn bộ tin nhắn đã nhắn trong phòng này. Máy chủ trở về trạng thái ban đầu, xóa bỏ 100% độ trễ và lag.',
                  'Erase all messages sent in this room. Returns the server to a fresh state with zero latency.',
                  '清空此房间内的所有消息。使服务器恢复初始状态，彻底消除延迟与卡顿。'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Weekly Auto-Prune Toggle */}
        <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:bg-slate-950">
          <input
            type="checkbox"
            checked={autoWeekly}
            onChange={(e) => setAutoWeekly(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-700 cursor-pointer"
          />
          <div className="text-[11px] min-w-0">
            <span className="font-bold text-slate-200 block">{pick('Tự động reset dọn dẹp mỗi tuần (7 ngày)', 'Auto-cleanup weekly (every 7 days)', '每周自动清理（7 天）')}</span>
            <span className="text-slate-400 text-[10px]">
              {pick(
                'Hệ thống sẽ tự động quét và xóa tin nhắn cũ hơn 7 ngày khi mở phòng để máy chủ luôn mượt mà.',
                'The system will automatically scan and remove messages older than 7 days when opening the room.',
                '系统将在打开房间时自动扫描并删除超过 7 天的消息，以保持服务器流畅运行。'
              )}
            </span>
          </div>
        </label>

        {/* Status Feedback */}
        {resultMessage && (
          <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            resultMessage.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
          }`}>
            {resultMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{resultMessage.text}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {pick('Đóng', 'Close', '关闭')}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleExecuteReset}
            className={`px-4 py-2 rounded-xl font-bold text-xs shadow-lg flex items-center gap-1.5 transition-all active:scale-95 text-white ${
              selectedMode === 'all'
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-rose-600/20'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/20'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{pick('Đang xử lý dọn dẹp...', 'Cleaning up...', '正在清理...')}</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{pick('Thực hiện Reset Máy Chủ', 'Execute Server Reset', '执行服务器重置')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
