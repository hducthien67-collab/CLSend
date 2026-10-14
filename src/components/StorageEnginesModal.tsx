import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  HardDrive, 
  Share2, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  Server, 
  Trash2, 
  HelpCircle,
  ExternalLink,
  Sliders
} from 'lucide-react';
import { 
  getTelegramConfig, 
  saveTelegramConfig, 
  TelegramStorageConfig 
} from '../utils/telegramStorage';
import { 
  getCommunityNodeStats, 
  saveCommunityNodeStats, 
  clearCommunitySwarmCache,
  CommunityNodeStats 
} from '../utils/p2pCommunitySwarm';

interface StorageEnginesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StorageEnginesModal: React.FC<StorageEnginesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'p2p' | 'telegram'>('p2p');
  
  // Telegram state
  const [tgConfig, setTgConfig] = useState<TelegramStorageConfig>(getTelegramConfig());
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestSuccess, setTgTestSuccess] = useState<string | null>(null);
  const [tgTestError, setTgTestError] = useState<string | null>(null);

  // P2P Swarm state
  const [p2pStats, setP2pStats] = useState<CommunityNodeStats>(getCommunityNodeStats());
  const [cacheClearedSuccess, setCacheClearedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTgConfig(getTelegramConfig());
      setP2pStats(getCommunityNodeStats());
      setTgTestSuccess(null);
      setTgTestError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveTelegram = () => {
    saveTelegramConfig(tgConfig);
    setTgTestSuccess('Đã lưu cấu hình Telegram Cloud thành công!');
    setTimeout(() => setTgTestSuccess(null), 3000);
  };

  const handleTestTelegramConnection = async () => {
    if (!tgConfig.botToken || !tgConfig.chatId) {
      setTgTestError('Vui lòng nhập đầy đủ Bot Token và Chat ID.');
      return;
    }
    setTgTesting(true);
    setTgTestError(null);
    setTgTestSuccess(null);

    try {
      const res = await fetch(`https://api.telegram.org/bot${tgConfig.botToken.trim()}/getChat?chat_id=${tgConfig.chatId.trim()}`);
      const data = await res.json();
      if (data.ok) {
        setTgTestSuccess(`Kết nối thành công tới kênh: ${data.result?.title || 'Kênh riêng tư'}!`);
        saveTelegramConfig({ ...tgConfig, enabled: true });
        setTgConfig(prev => ({ ...prev, enabled: true }));
      } else {
        setTgTestError(data.description || 'Không thể kết nối tới kênh Telegram.');
      }
    } catch (err: any) {
      setTgTestError(err.message || 'Lỗi mạng khi kiểm tra Bot Telegram.');
    } finally {
      setTgTesting(false);
    }
  };

  const handleToggleP2PNode = () => {
    const updated = { ...p2pStats, isActive: !p2pStats.isActive };
    setP2pStats(updated);
    saveCommunityNodeStats(updated);
  };

  const handleChangeMaxCache = (mb: number) => {
    const updated = { ...p2pStats, maxCacheMb: mb };
    setP2pStats(updated);
    saveCommunityNodeStats(updated);
  };

  const handleClearP2PCache = async () => {
    await clearCommunitySwarmCache();
    setP2pStats(getCommunityNodeStats());
    setCacheClearedSuccess(true);
    setTimeout(() => setCacheClearedSuccess(false), 2500);
  };

  const usedMb = (p2pStats.usedCacheBytes / (1024 * 1024)).toFixed(1);
  const cachePercent = Math.min(100, Math.round(((p2pStats.usedCacheBytes / (1024 * 1024)) / p2pStats.maxCacheMb) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-[#111214] text-slate-100 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden select-none flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-[#18191c] to-slate-900 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Hệ Thống Lưu Trữ Vô Hạn & Nút P2P
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                  DUAL-ENGINE
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Tăng cường dung lượng lưu trữ thật và tăng tốc tải ngang hàng cộng đồng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-[#16171a] px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('p2p')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all border-b-2 ${
              activeTab === 'p2p'
                ? 'border-emerald-500 text-emerald-400 bg-[#1c1d22]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>Nút Chia Sẻ P2P (Kiểu Minecraft Launcher)</span>
          </button>
          <button
            onClick={() => setActiveTab('telegram')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all border-b-2 ${
              activeTab === 'telegram'
                ? 'border-sky-500 text-sky-400 bg-[#1c1d22]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Kho Vô Hạn Telegram Bot</span>
          </button>
        </div>

        {/* Body content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-[#111214]">
          {/* TAB 1: P2P COMMUNITY SEED NODE */}
          {activeTab === 'p2p' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Introduction Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-500/30 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <h3 className="text-sm font-bold text-white">Mạng Lưới Chia Sẻ Ngang Hàng Cộng Đồng (P2P Swarm)</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Giống như launcher Minecraft PCL2, khi bạn bật nút này, trình duyệt sẽ lưu đệm một phần nhỏ các tệp bạn đã tải để chia sẻ trực tiếp (P2P Seeding) cho các thành viên khác đang online, giúp cả cộng đồng tải tệp siêu tốc mà không tốn dung lượng máy chủ!
                  </p>
                </div>
                <button
                  onClick={handleToggleP2PNode}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    p2pStats.isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {p2pStats.isActive ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
                </button>
              </div>

              {/* Real-time Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#18191c] p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Dung lượng chia sẻ
                  </span>
                  <div className="text-base sm:text-lg font-extrabold text-white">
                    {usedMb} MB <span className="text-xs text-slate-400 font-normal">/ {p2pStats.maxCacheMb} MB</span>
                  </div>
                </div>

                <div className="bg-[#18191c] p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-teal-400" /> Tệp đang Seeding
                  </span>
                  <div className="text-base sm:text-lg font-extrabold text-white">
                    {p2pStats.sharedFilesCount} <span className="text-xs text-slate-400 font-normal">tệp đệm</span>
                  </div>
                </div>

                <div className="bg-[#18191c] p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Lượt tăng tốc (Relay)
                  </span>
                  <div className="text-base sm:text-lg font-extrabold text-white">
                    {p2pStats.relayedTransfersCount} <span className="text-xs text-slate-400 font-normal">lần</span>
                  </div>
                </div>
              </div>

              {/* Cache Progress Bar */}
              <div className="bg-[#18191c] p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-emerald-400" /> Giới hạn bộ nhớ đệm tối đa
                  </span>
                  <span className="text-emerald-400 font-mono font-bold">{p2pStats.maxCacheMb} MB</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{ width: `${cachePercent}%` }}
                  />
                </div>

                {/* Presets buttons */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-[11px] text-slate-400">Chọn mức đóng góp:</span>
                  {[250, 500, 1024, 2048].map((mb) => (
                    <button
                      key={mb}
                      type="button"
                      onClick={() => handleChangeMaxCache(mb)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        p2pStats.maxCacheMb === mb
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleClearP2PCache}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa toàn bộ bộ nhớ đệm P2P
                </button>
                {cacheClearedSuccess && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã xóa sạch cache!
                  </span>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TELEGRAM BOT CLOUD STORAGE */}
          {activeTab === 'telegram' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 border border-sky-500/30 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-white">Kho Lưu Trữ Vô Hạn Qua Telegram Bot</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Lưu trữ tệp và ảnh không giới hạn dung lượng bằng cách mượn kênh Telegram riêng tư làm kho chứa. Tệp sẽ được tải thẳng lên máy chủ Telegram và lấy đường link tải về vĩnh viễn với chi phí 0đ!
                </p>
              </div>

              <div className="bg-[#18191c] p-4 rounded-xl border border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200">
                    Bật chế độ lưu qua Telegram Cloud
                  </label>
                  <input
                    type="checkbox"
                    checked={tgConfig.enabled}
                    onChange={(e) => setTgConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="w-4 h-4 accent-sky-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Telegram Bot Token:
                  </label>
                  <input
                    type="password"
                    value={tgConfig.botToken}
                    onChange={(e) => setTgConfig(prev => ({ ...prev, botToken: e.target.value }))}
                    placeholder="Ví dụ: 7123456789:AAHxyz..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Lấy miễn phí bằng cách chat với <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline">@BotFather</a> trên Telegram.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Kênh lưu trữ Chat ID (Private Channel ID):
                  </label>
                  <input
                    type="text"
                    value={tgConfig.chatId}
                    onChange={(e) => setTgConfig(prev => ({ ...prev, chatId: e.target.value }))}
                    placeholder="Ví dụ: -1001234567890 hoặc @ten_kenh_cua_ban"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Tạo 1 Kênh (Channel) riêng trên Telegram, thêm Bot của bạn vào làm Admin rồi dán ID kênh vào đây.
                  </p>
                </div>

                {/* Notifications */}
                {tgTestSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{tgTestSuccess}</span>
                  </div>
                )}
                {tgTestError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center gap-2">
                    <X className="w-4 h-4 shrink-0" />
                    <span>{tgTestError}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestTelegramConnection}
                    disabled={tgTesting}
                    className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>{tgTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối Bot'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTelegram}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
                  >
                    Lưu cài đặt
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-[#16171a] border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Dữ liệu được mã hóa và bảo vệ an toàn</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-md"
          >
            Hoàn tất & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
