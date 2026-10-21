import React from 'react';
import { useAuth } from '../context/AuthContext';
import { CloudSendLogo } from './CloudSendLogo';
import { 
  Send, 
  Download, 
  MessagesSquare, 
  Cloud,
  Settings, 
  Laptop, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Globe, 
  Radio,
  ExternalLink,
  Database,
  Tv,
  Scale,
  Palette,
  Sparkles,
  Users,
  LogOut,
  Check,
  ChevronLeft
} from 'lucide-react';
import { isDevUser } from '../utils/devModeration';
import { useLanguage, LanguageCode } from '../context/LanguageContext';

interface NavbarProps {
  activeTab: 'send' | 'receive' | 'chat' | 'drive';
  setActiveTab: (tab: 'send' | 'receive' | 'chat' | 'drive') => void;
  onOpenSettings: () => void;
  onOpenRules?: () => void;
  onOpenDevConsole?: () => void;
  onOpenDevPage?: () => void;
  onToggleViewMode?: () => void;
  incomingCount?: number;
  unreadMessagesCount?: number;
  onOpenDesignStudio?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  onOpenRules,
  onOpenDevConsole,
  onOpenDevPage,
  onToggleViewMode,
  incomingCount = 0,
  unreadMessagesCount = 0,
  onOpenDesignStudio,
}) => {
  const { currentUser, settings, userProfile, logout } = useAuth();
  const { currentLang, setLanguage, t, languages } = useLanguage();
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = React.useState(false);
  const [isLangSubMenuOpen, setIsLangSubMenuOpen] = React.useState(false);
  const isDev = isDevUser(currentUser?.email);

  const handleSelectLanguage = (langCode: LanguageCode) => {
    setLanguage(langCode);
    setIsLangSubMenuOpen(false);
    setIsAvatarMenuOpen(false);
  };

  const activeAvatarUrl = settings.customAvatarUrl || userProfile?.customAvatarUrl || currentUser?.photoURL;

  const getDeviceIcon = () => {
    switch (settings.deviceType) {
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      case 'tablet': return <Tablet className="w-4 h-4" />;
      case 'desktop': return <Monitor className="w-4 h-4" />;
      case 'tv': return <Tv className="w-4 h-4 text-emerald-400 animate-pulse" />;
      default: return <Laptop className="w-4 h-4" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900 border-b border-slate-800 shadow-md">
      <div className="w-full px-2.5 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* === GÓC BÊN TRÁI: Logo + Tên + Cụm Tab chuyển đổi === */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {/* Logo and Brand */}
          <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer shrink-0" onClick={() => setActiveTab('send')}>
            <div className="relative group">
              <CloudSendLogo className="w-8 h-8 sm:w-9 sm:h-9 shadow-lg shadow-emerald-500/10 rounded-xl transition-transform group-hover:scale-105" size={36} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-white text-sm sm:text-base tracking-tight m-0 p-0 inline-block leading-none">CLSend</h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-mono font-medium px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Radio className="w-2 h-2 animate-pulse" />
                  Relay
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate hidden xl:block">
                {t('nav.subtitle')}
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Gửi / Nhận / Phòng Chat) - Placed directly on the left side */}
          <nav className="hidden md:flex items-center p-1 bg-slate-950/70 border border-slate-800 rounded-xl shrink-0">
            <button
              id="nav-send-tab"
              type="button"
              onClick={() => setActiveTab('send')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'send'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t('nav.send')}</span>
            </button>

            <button
              id="nav-receive-tab"
              type="button"
              onClick={() => setActiveTab('receive')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'receive'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('nav.receive')}</span>
              {incomingCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center animate-bounce">
                  {incomingCount}
                </span>
              )}
            </button>

            <button
              id="nav-chat-tab"
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'chat'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <MessagesSquare className="w-3.5 h-3.5" />
              <span>{t('nav.chat')}</span>
              {unreadMessagesCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              )}
            </button>

            <button
              id="nav-drive-tab"
              type="button"
              onClick={() => setActiveTab('drive')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'drive'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>{t('nav.drive')}</span>
            </button>
          </nav>
        </div>

        {/* === GÓC BÊN PHẢI: Thiết bị + Cài đặt + Avatar === */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* TV Mode Quick Status Pill */}
          {(settings.deviceType === 'tv' || settings.tvModeEnabled) && (
            <button
              id="navbar-tv-mode-badge"
              type="button"
              onClick={onOpenSettings}
              title="Chế độ Smart TV đang bật. Nhấn để mở Cài đặt & chỉnh DPI"
              className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all shadow-sm"
            >
              <Tv className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="hidden md:inline">Smart TV</span>
            </button>
          )}

          {/* Current device preview badge */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
            <span className="text-emerald-400">{getDeviceIcon()}</span>
            <span className="font-medium text-white max-w-[120px] truncate">
              {settings.deviceName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>

          {/* DATASTORE Direct Button (CHỈ HIỂN THỊ DUY NHẤT CHO DEV: hducthien67@gmail.com) */}
          {isDev && (
            <div className="flex items-center bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-500/40 rounded-xl p-0.5 shadow-lg shadow-emerald-500/10 transition-colors">
              <button
                id="open-datastore-btn"
                type="button"
                onClick={() => {
                  if (onOpenDevPage) {
                    onOpenDevPage();
                  } else {
                    window.location.href = '/?page=datastore';
                  }
                }}
                title="Mở TRANG WEB DATASTORE (Dành riêng cho DEV)"
                className="px-2 py-1 rounded-lg text-emerald-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">DATASTORE</span>
              </button>
              <button
                id="open-datastore-tab-btn"
                type="button"
                onClick={() => {
                  window.open('/?page=datastore', '_blank');
                }}
                title="Mở trang web Datastore trong TAB MỚI riêng biệt"
                className="p-1 rounded-lg hover:bg-emerald-500/30 text-emerald-300 hover:text-white border-l border-emerald-500/30 transition-colors"
              >
                <ExternalLink className="w-3 h-3 text-emerald-400" />
              </button>
            </div>
          )}

                    {/* Design Studio / Khung Thiết Kế Button */}
          {onOpenDesignStudio && (
            <button
              id="open-design-studio-btn"
              type="button"
              onClick={onOpenDesignStudio}
              title="Khung Thiết Kế - Tùy chỉnh avatar, khung viền, nhãn dán & giao diện 🥳"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 text-indigo-200 hover:text-white border border-indigo-500/40 hover:border-indigo-400 text-xs font-semibold transition-all shadow-sm group cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline">Khung Thiết Kế</span>
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            </button>
          )}

          {/* Rules / Nội quy Button */}
          {onOpenRules && (
            <button
              id="open-rules-navbar-btn"
              type="button"
              onClick={onOpenRules}
              title="Bảng Nội Quy & Điều Khoản Sử Dụng (Căn cứ xử lý vi phạm)"
              className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-amber-400 border border-slate-700/80 hover:border-amber-500/40 text-xs font-semibold transition-all shadow-sm group"
            >
              <Scale className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="hidden md:inline">{t('nav.rules')}</span>
            </button>
          )}

          {/* User Avatar with Dropdown Menu Popup */}
          <div className="relative">
            <div
              onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
              title={`${currentUser?.displayName || 'Tài khoản'} - Nhấn để mở menu`}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold cursor-pointer ring-2 ring-emerald-500/40 hover:ring-emerald-400 transition-all shadow-md overflow-hidden relative"
              style={{ backgroundColor: settings.avatarColor }}
            >
              {activeAvatarUrl ? (
                <img 
                  src={activeAvatarUrl} 
                  alt={currentUser?.displayName || 'Avatar'} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                (currentUser?.displayName || currentUser?.email || 'U')[0].toUpperCase()
              )}
            </div>

            {/* Popup Dropdown Menu at bottom-left of avatar */}
            {isAvatarMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    setIsLangSubMenuOpen(false);
                  }} 
                />
                
                <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-xs font-bold text-white truncate">
                      {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Tài khoản'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {currentUser?.email || t('nav.connected')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      setIsLangSubMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-emerald-400" />
                    <span>{t('nav.settings')}</span>
                  </button>

                  {/* Nút Ngôn ngữ có bản nhỏ mở ra bên cạnh */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLangSubMenuOpen(!isLangSubMenuOpen);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isLangSubMenuOpen
                          ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          : 'text-slate-200 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Globe className="w-4 h-4 text-sky-400" />
                        <span>{t('nav.language')}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span>{languages.find(l => l.code === currentLang)?.flag || '🌐'}</span>
                        <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-200 ${isLangSubMenuOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Bảng nhỏ bên cạnh chứa ngôn ngữ trên thế giới */}
                    {isLangSubMenuOpen && (
                      <div 
                        translate="no"
                        onClick={(e) => e.stopPropagation()}
                        className="notranslate absolute right-full top-0 mr-2 w-56 rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-slate-700 shadow-2xl z-50 p-2 space-y-1 animate-in fade-in slide-in-from-right-3 duration-200"
                      >
                        <div className="px-2.5 py-1 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3 text-sky-400" />
                            {t('nav.world_languages')}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {languages.length}
                          </span>
                        </div>

                        <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-0.5 pr-0.5">
                          {languages.map((lang) => {
                            const isSelected = currentLang === lang.code;
                            return (
                              <button
                                key={lang.code}
                                type="button"
                                onClick={() => handleSelectLanguage(lang.code)}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                                  isSelected
                                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-base leading-none">{lang.flag}</span>
                                  <span className="truncate">{lang.name}</span>
                                </div>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 stroke-[2.5]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      setIsAvatarMenuOpen(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>{t('nav.switch_account')}</span>
                  </button>

                  <div className="border-t border-slate-800 my-1 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsAvatarMenuOpen(false);
                        await logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>{t('nav.logout')}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar - LocalSend native style */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-3 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="flex items-center justify-around gap-1 max-w-md mx-auto">
          <button
            id="mobile-nav-send"
            type="button"
            onClick={() => setActiveTab('send')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
              activeTab === 'send'
                ? 'text-emerald-400 font-semibold bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">{t('nav.send')}</span>
          </button>

          <button
            id="mobile-nav-receive"
            type="button"
            onClick={() => setActiveTab('receive')}
            className={`flex-1 relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
              activeTab === 'receive'
                ? 'text-emerald-400 font-semibold bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Download className="w-5 h-5 mb-0.5" />
              {incomingCount > 0 && (
                <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-slate-950 font-bold text-[9px] flex items-center justify-center">
                  {incomingCount}
                </span>
              )}
            </div>
            <span className="text-[11px]">{t('nav.receive')}</span>
          </button>

          <button
            id="mobile-nav-chat"
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
              activeTab === 'chat'
                ? 'text-emerald-400 font-semibold bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <MessagesSquare className="w-5 h-5 mb-0.5" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
              )}
            </div>
            <span className="text-[11px]">{t('nav.chat')}</span>
          </button>

          <button
            id="mobile-nav-drive"
            type="button"
            onClick={() => setActiveTab('drive')}
            className={`flex-1 relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
              activeTab === 'drive'
                ? 'text-emerald-400 font-semibold bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">{t('nav.drive')}</span>
          </button>

          <button
            id="mobile-nav-settings"
            type="button"
            onClick={onOpenSettings}
            className="flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-slate-400 hover:text-slate-200 transition-all"
          >
            <Settings className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">{t('nav.settings')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
