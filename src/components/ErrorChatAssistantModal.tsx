import React, { useState } from 'react';
import { Sparkles, RefreshCw, Download, AlertTriangle, X, Send, Bot, CheckCircle2, Copy } from 'lucide-react';

interface ErrorChatAssistantModalProps {
  fileName: string;
  errorMessage: string;
  onRetry?: () => void;
  onDirectCDN?: () => void;
  onClose: () => void;
}

export const ErrorChatAssistantModal: React.FC<ErrorChatAssistantModalProps> = ({
  fileName,
  errorMessage,
  onRetry,
  onDirectCDN,
  onClose
}) => {
  const [messages, setMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string }>>([
    {
      sender: 'bot',
      text: `Ối dồi ôi! Tệp "${fileName}" vừa gặp chút trục trặc khi truyền tải từ mây (Telegram / Server): "${errorMessage}". Đừng lo, tớ ở đây để hỗ trợ bạn xử lý ngay lập tức! 🤖✨`
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isResolved, setIsResolved] = useState(false);

  const handleSendCustomQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setInputValue('');

    setTimeout(() => {
      let botReply = 'Tớ đã ghi nhận yêu cầu của bạn! Hệ thống đang cố gắng khôi phục lại kết nối. Bạn hãy thử nhấn nút "Thử lại tải tệp" hoặc "Tải trực tiếp qua CDN gốc" bên dưới nhé.';
      const lower = userText.toLowerCase();
      if (lower.includes('thử') || lower.includes('lai') || lower.includes('retry')) {
        botReply = 'Tuyệt vời! Đang kích hoạt tiến trình tải lại tệp cho bạn đây...';
        if (onRetry) onRetry();
      } else if (lower.includes('cdn') || lower.includes('gốc') || lower.includes('telegram')) {
        botReply = 'Đang chuyển hướng sang luồng tải trực tiếp từ Telegram CDN gốc...';
        if (onDirectCDN) onDirectCDN();
      } else if (lower.includes('cảm ơn') || lower.includes('thanks')) {
        botReply = 'Không có chi nha! Chúc bạn có trải nghiệm tuyệt vời cùng CLSend ❤️';
      }
      setMessages(prev => [...prev, { sender: 'bot', text: botReply }]);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-900/50 via-slate-900 to-teal-900/50 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner relative">
              <Bot className="w-6 h-6 animate-pulse" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Trợ Lý Hỗ Trợ CLSend AI</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live Support
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Phản hồi thông minh khi xảy ra sự cố truyền tải</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/60 font-sans text-xs sm:text-sm">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {m.sender === 'bot' ? (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 shrink-0 mt-0.5 font-bold text-xs">
                  Bạn
                </div>
              )}

              <div
                className={`max-w-[80%] p-3.5 rounded-2xl leading-relaxed shadow-sm ${
                  m.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {isResolved && (
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Sự cố đã được giải quyết thành công!</span>
            </div>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={() => {
                setIsResolved(true);
                onRetry();
              }}
              className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại tải tệp</span>
            </button>
          )}

          {/* Copy Debug URL */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Đã copy thông tin chẩn đoán, hãy gửi cho kỹ thuật viên!");
            }}
            className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium text-xs flex items-center justify-center gap-2 border border-amber-500/30 transition-all active:scale-95"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy mã chẩn đoán</span>
          </button>

          {onDirectCDN && (
            <button
              type="button"
              onClick={() => {
                setIsResolved(true);
                onDirectCDN();
              }}
              className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tải trực tiếp</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            Đóng
          </button>
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendCustomQuery} className="p-3 bg-slate-950 border-t border-slate-850 flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Nhập câu hỏi hoặc phản hồi với trợ lý..."
            className="flex-1 py-2 px-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          <button
            type="submit"
            className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-md"
            title="Gửi"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
