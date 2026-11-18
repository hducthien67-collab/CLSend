import React, { useState } from 'react';
import { Sparkles, RefreshCw, Download, AlertTriangle, X, Send, Bot, CheckCircle2, Copy } from 'lucide-react';
import { useLanguage, pickLang } from '../context/LanguageContext';

interface ErrorChatAssistantModalProps {
  fileName: string;
  errorMessage: string;
  diagnosticInfo?: { blobType: string; blobSize: number };
  onRetry?: () => void;
  onDirectCDN?: () => void;
  onClose: () => void;
}

export const ErrorChatAssistantModal: React.FC<ErrorChatAssistantModalProps> = ({
  fileName,
  errorMessage,
  diagnosticInfo,
  onRetry,
  onDirectCDN,
  onClose
}) => {
  const { currentLang } = useLanguage();
  const pick = (vi: string, en: string, zh: string) => pickLang(currentLang, vi, en, zh);

  React.useEffect(() => {
    if (diagnosticInfo) {
      console.log('[Download Diagnostic] Blob Info:', diagnosticInfo);
    }
  }, [diagnosticInfo]);

  const [messages, setMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string }>>([
    {
      sender: 'bot',
      text: pick(
        'Xin chào! Tớ là Trợ lý Hỗ trợ ClSend. Tệp "{file}" vừa gặp sự cố: "{err}". Bạn có thể nhấn thử tải lại hoặc tải trực tiếp qua CDN bên dưới.',
        'Hello! I am the ClSend Support Helper. File "{file}" encountered an issue: "{err}". You can retry downloading or use Direct CDN below.',
        '您好！我是 ClSend 故障助手。文件 "{file}" 遇到问题："{err}"。您可以点击下方重试下载或通过 CDN 直接下载。'
      ).replace('{file}', fileName).replace('{err}', errorMessage)
    }
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSendCustomQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setInputValue('');

    setTimeout(() => {
      let botReply = pick(
        'Hệ thống đang khôi phục kết nối. Bạn hãy thử nhấn nút "Thử lại tải tệp" hoặc "Tải trực tiếp CDN" bên dưới nhé.',
        'Restoring connection. Please try clicking "Retry File Download" or "Direct CDN Download" below.',
        '正在恢复连接。请尝试点击下方的“重试下载文件”或“CDN 直接下载”按钮。'
      );
      const lower = userText.toLowerCase();
      if (lower.includes('thử') || lower.includes('lai') || lower.includes('retry')) {
        botReply = pick('Đang kích hoạt tiến trình tải lại tệp cho bạn...', 'Triggering file download retry...', '正在为您重新触发文件下载...');
        if (onRetry) onRetry();
      } else if (lower.includes('cdn') || lower.includes('gốc') || lower.includes('direct')) {
        botReply = pick('Đang chuyển hướng sang luồng tải trực tiếp CDN...', 'Switching to Direct CDN download stream...', '正在切换至 CDN 直接下载通道...');
        if (onDirectCDN) onDirectCDN();
      } else if (lower.includes('cảm ơn') || lower.includes('thanks')) {
        botReply = pick('Không có chi! ClSend luôn sẵn sàng hỗ trợ bạn.', 'You are welcome! ClSend is always ready to help.', '不客气！ClSend 随时为您提供支持。');
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
                <span>{pick('Trợ Lý Chẩn Đoán Lỗi Tải Tệp', 'Download Diagnostics Helper', '下载诊断助手')}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {pick('Hỗ trợ', 'Helper', '助手')}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">{pick('Chẩn đoán lỗi kết nối và hỗ trợ tải lại tệp', 'Diagnose connection errors and retry downloads', '诊断连接错误并支持重新下载')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  <span className="text-xs font-bold">{pick('Bạn', 'You', '你')}</span>
                </div>
              )}

              <div
                className={`p-3 rounded-2xl max-w-[80%] leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-xs'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs shadow-md'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={() => {
                if (onRetry) onRetry();
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{pick('Thử lại tải tệp', 'Retry File Download', '重试下载文件')}</span>
            </button>
          )}

          {onDirectCDN && (
            <button
              type="button"
              onClick={() => {
                if (onDirectCDN) onDirectCDN();
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{pick('Tải trực tiếp CDN', 'Direct CDN Download', 'CDN 直接下载')}</span>
            </button>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendCustomQuery} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={pick('Hỏi về lỗi này...', 'Ask about this error...', '询问此错误...')}
            className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all cursor-pointer flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
