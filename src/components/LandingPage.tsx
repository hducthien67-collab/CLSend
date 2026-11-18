import React from 'react';
import { 
  Download, 
  Globe, 
  Check, 
  ArrowRight,
  Smartphone,
  Monitor,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { CloudSendLogo } from './CloudSendLogo';
import { SilkFabricBackground } from './SilkFabricBackground';
import { useLanguage, pickLang } from '../context/LanguageContext';

interface LandingPageProps {
  onEnterApp: () => void;
  onOpenDownload: (initialTab?: 'mobile' | 'pc') => void;
  onOpenRules?: () => void;
  isLoggedIn?: boolean;
  deferredPrompt?: any;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onEnterApp, 
  onOpenDownload,
  onOpenRules,
  isLoggedIn = false,
  deferredPrompt
}) => {
  const { currentLang } = useLanguage();
  const pick = <T,>(vi: T, en: T, zh?: T) => pickLang(currentLang, vi, en, zh);
  const isMobile = typeof window !== 'undefined' && /mobile|iphone|ipod|android/i.test(navigator.userAgent.toLowerCase());

  // 1-Click Mobile Install Handler: triggers deferredPrompt directly if available!
  const handleMobileDownloadClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          return;
        }
      } catch (err) {
        console.warn('Direct mobile install prompt failed:', err);
      }
    }
    // If prompt not available (e.g. iOS Safari, or already used), open mobile install sheet
    onOpenDownload('mobile');
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200 relative overflow-x-hidden">
      {/* Living Silk Wave Background (Dark + Soft Emerald currents) */}
      <SilkFabricBackground className="fixed inset-0 pointer-events-none -z-10" intensity="subtle" showParticles={true} showGrid={false} />

      {/* Top Ambient Green Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none rounded-full -z-10" />

      {/* Top Header / Navigation */}
      <header className="w-full bg-[#0b0f19]/85 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <div 
            onClick={onEnterApp}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
              <CloudSendLogo className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-white bg-clip-text text-transparent">
                ClSend
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30 hidden sm:inline-block">
                Web & PWA
              </span>
            </div>
          </div>

          {/* Clean Trimmed-Down Navigation Links */}
          <nav className="flex items-center gap-3.5 sm:gap-6 text-xs sm:text-sm font-semibold">
            {onOpenRules && (
              <button
                type="button"
                onClick={onOpenRules}
                className="text-slate-300 hover:text-emerald-400 tracking-wide transition-colors uppercase cursor-pointer hidden sm:inline-flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{pick('Điều Khoản & Bảo Mật', 'Terms & Privacy', '条款与隐私')}</span>
              </button>
            )}

            {/* Quick Install button in header */}
            <button
              type="button"
              onClick={() => onOpenDownload(isMobile ? 'mobile' : 'pc')}
              className="text-xs sm:text-sm font-bold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 sm:hidden" />
              <span>{isMobile ? pick('Ghim Ra Màn Hình', 'Install PWA', '安装到桌面') : pick('Cài PWA', 'Install PWA', '安装 PWA')}</span>
            </button>

            <button
              type="button"
              onClick={onEnterApp}
              className="text-emerald-400 hover:text-emerald-300 font-bold tracking-wide transition-colors uppercase cursor-pointer flex items-center gap-1 ml-1"
            >
              <span>{isLoggedIn ? pick('Vào Ứng Dụng', 'Open App', '进入应用') : pick('Đăng Nhập', 'Sign In', '登录')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </nav>
        </div>
      </header>

      {/* Main Center Area with Dark + Emerald Hero Card */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14 flex items-center justify-center relative z-10">
        <div className="w-full bg-slate-900/90 rounded-3xl shadow-2xl shadow-black/70 border border-slate-800/90 hover:border-emerald-500/40 p-6 sm:p-10 lg:p-14 backdrop-blur-xl relative overflow-hidden transition-all duration-300">
          
          {/* Subtle inside ambient glow */}
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
            
            {/* Left Column: Heading, Checklist, and 1-Click Mobile & PC Action Buttons */}
            <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center text-left">
              <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-white leading-[1.2] tracking-tight mb-2.5">
                {isMobile
                  ? pick('ClSend Mobile — Truyền Tệp & Chat Trên Trình Duyệt', 'ClSend Mobile — File Transfer & Chat in Browser', 'ClSend 移动版 — 浏览器高速传文件与聊天')
                  : pick('ClSend Web App — Chia Sẻ Tệp & Chat Đa Nền Tảng', 'ClSend Web App — Cross-Platform File Sharing & Chat', 'ClSend 网页应用 — 跨平台文件传输与聊天')}
              </h1>

              <p className="text-sm sm:text-base font-semibold text-slate-300 mb-6 sm:mb-8">
                {isMobile 
                  ? pick('Dùng ngay trên trình duyệt hoặc ghim thành ứng dụng Web (PWA) trên Android & iPhone chỉ với 1 chạm', 'Use directly in your browser or pin as a Web App (PWA) on Android & iPhone in 1 tap', '直接在浏览器使用，或一键将网页应用 (PWA) 固定到 Android 与 iPhone 主屏幕')
                  : pick('Chạy trực tiếp trên trình duyệt hoặc cài đặt dạng Web App (PWA) cho Windows, macOS, Android & iOS', 'Run directly in your browser or install as a Web App (PWA) on Windows, macOS, Android & iOS', '直接在浏览器运行，或作为轻量 Web 应用 (PWA) 安装到 Windows、macOS、Android 与 iOS')}
              </p>

              {/* Checklist items with EMERALD GREEN checkmarks */}
              <ul className="space-y-3.5 mb-8 sm:mb-10 text-slate-200 text-xs sm:text-sm font-medium">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>{pick('Truyền tệp, ảnh, video qua P2P & Cloud Relay (tối đa 10 GB/tệp) + Kho Cloud Drive 5 GB', 'Send files, photos & videos via P2P & Cloud Relay (up to 10 GB/file) + 5 GB Cloud Drive', '通过 P2P 与云中继传输文件及音视频（单文件最高 10 GB）+ 5 GB 个人云盘')}</span>
                </li>

                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>{pick('Đồng bộ tức thì giữa Điện thoại & Máy tính bằng mã QR hoặc mã PIN 6 số', 'Instant sync between Phone & Computer via QR code or 6-digit PIN', '通过二维码或 6 位 PIN 码在手机与电脑间实时同步')}</span>
                </li>

                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>{pick('Phòng chat trực tuyến thời gian thực, hỗ trợ đa ngôn ngữ & kiểm duyệt an toàn AI', 'Real-time multi-language chat rooms with AI safety moderation & transparent rules', '支持多语言实时聊天室、AI 安全内容审核与透明规则')}</span>
                </li>
              </ul>

              {/* Action Buttons: Tailored for Web-first & 1-Click PWA */}
              {isMobile ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4">
                    <button
                      id="mobile-direct-install-cta-btn"
                      type="button"
                      onClick={handleMobileDownloadClick}
                      className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:from-emerald-600 active:to-teal-500 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-500/25 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                    >
                      <Smartphone className="w-5 h-5 stroke-[2.5] text-slate-950" />
                      <span>{pick('📲 Cài Đặt PWA (1-Chạm)', '📲 Install PWA (1-Tap)', '📲 一键安装 PWA')}</span>
                    </button>

                    <button
                      id="landing-use-web-btn"
                      type="button"
                      onClick={onEnterApp}
                      className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl border-2 border-emerald-500/80 hover:bg-emerald-500/15 text-emerald-400 hover:text-emerald-300 font-bold text-sm sm:text-base transition-all active:scale-[0.98] cursor-pointer bg-slate-900/80"
                    >
                      <Globe className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                      <span>{isLoggedIn ? pick('Vào ứng dụng', 'Open App', '进入应用') : pick('Dùng ngay bản web', 'Use Web Version', '使用网页版')}</span>
                    </button>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenDownload('pc')}
                      className="text-xs text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>{pick('Xem hướng dẫn cài PWA trên máy tính (Windows / macOS)', 'View desktop PWA guide (Windows / macOS)', '查看电脑版 PWA 安装指南 (Windows / macOS)')}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    {onOpenRules && (
                      <button
                        type="button"
                        onClick={onOpenRules}
                        className="text-xs text-emerald-400/90 hover:text-emerald-300 transition-colors cursor-pointer inline-flex items-center gap-1 sm:hidden"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{pick('Điều khoản & Bảo mật', 'Terms & Privacy', '条款与隐私')}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4 flex-wrap">
                  <button
                    id="landing-use-web-btn"
                    type="button"
                    onClick={onEnterApp}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:from-emerald-700 active:to-teal-600 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-600/30 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                  >
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                    <span>{isLoggedIn ? pick('Vào ứng dụng', 'Open App', '进入应用') : pick('Dùng ngay bản web', 'Launch Web App', '立即使用网页版')}</span>
                  </button>

                  <button
                    id="landing-download-pc-btn"
                    type="button"
                    onClick={() => onOpenDownload('pc')}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-750 text-emerald-300 hover:text-white font-bold text-sm sm:text-base border border-emerald-500/30 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                    <span>{pick('Cài PWA cho PC', 'Desktop PWA Guide', '电脑端 PWA 安装')}</span>
                  </button>

                  <button
                    id="landing-download-mobile-btn"
                    type="button"
                    onClick={() => onOpenDownload('mobile')}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-slate-700 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-slate-200 hover:text-emerald-300 font-bold text-sm sm:text-base transition-all active:scale-[0.98] cursor-pointer bg-slate-900/80"
                  >
                    <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                    <span>{pick('Mở trên điện thoại (QR)', 'Open on Phone (QR)', '手机端扫码使用')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: High Fidelity Laptop & Smartphone Showcase Mockup */}
            <div className="lg:col-span-6 xl:col-span-5 flex items-center justify-center relative mt-4 lg:mt-0 select-none pointer-events-none">
              <div className="relative w-full max-w-[420px] aspect-[4/3] flex items-center justify-center">
                
                {/* Laptop Mockup */}
                <div className="w-[85%] max-w-[340px] sm:max-w-[370px] flex flex-col items-center">
                  <div className="w-full bg-slate-900 rounded-t-xl p-1.5 sm:p-2 border border-slate-700 shadow-2xl relative">
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-700" />
                    <div className="w-full aspect-[16/10] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex flex-col text-[8px] sm:text-[9px] text-slate-300 font-sans">
                      <div className="h-4 sm:h-5 bg-slate-900 border-b border-slate-800 px-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded bg-emerald-500" />
                          <span className="font-bold text-white text-[7.5px]">ClSend Web & PWA</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[6.5px] text-slate-400">
                          <span className="text-emerald-400 font-semibold">• {pick('Trực tuyến', 'Online', '在线')}</span>
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-12 min-h-0">
                        <div className="col-span-4 bg-slate-900/80 border-r border-slate-800/80 p-1 space-y-1">
                          <div className="px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold truncate flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />
                            <span>ClSend User</span>
                          </div>
                          <div className="px-1 py-0.5 rounded text-slate-400 truncate">
                            {pick('Nhóm Relay P2P', 'P2P Relay Room', 'P2P 中继群组')}
                          </div>
                          <div className="px-1 py-0.5 rounded text-slate-400 truncate">
                            {pick('Kho Cloud Drive', 'Cloud Drive', '个人云盘')}
                          </div>
                        </div>

                        <div className="col-span-8 bg-slate-950 p-1.5 flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="bg-slate-900 rounded p-1 text-[7px] max-w-[85%] border border-slate-800">
                              <p className="text-emerald-400 font-bold mb-0.5">{pick('Tệp tin hoàn tất', 'Transfer Complete', '文件传输完成')}</p>
                              <p className="text-slate-300 truncate">project_docs_2026.pdf (14.2 MB)</p>
                            </div>
                            <div className="bg-emerald-500/20 text-emerald-200 rounded p-1 text-[7px] max-w-[75%] ml-auto border border-emerald-500/30 text-right">
                              {pick('Đã nhận tệp siêu tốc qua P2P! ⚡', 'Received fast via P2P! ⚡', '已通过 P2P 极速接收！⚡')}
                            </div>
                          </div>

                          <div className="h-3 bg-slate-900 rounded border border-slate-800 px-1 flex items-center text-slate-500 text-[6.5px]">
                            {pick('Nhập tin nhắn hoặc thả tệp...', 'Type message or drop file...', '输入消息或拖放文件...')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-[110%] h-2.5 sm:h-3 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 rounded-b-lg border-t border-slate-700 shadow-xl relative flex justify-center">
                    <div className="w-12 sm:w-16 h-1 bg-slate-600 rounded-b" />
                  </div>
                </div>

                {/* Smartphone Mockup */}
                <div className="absolute -left-2 sm:-left-3 bottom-0 w-[80px] sm:w-[95px] aspect-[9/18] bg-slate-900 rounded-[16px] sm:rounded-[18px] p-1 border-[1.5px] border-slate-700 shadow-2xl flex flex-col">
                  <div className="w-4 h-1 bg-black rounded-full mx-auto mb-1 shrink-0" />
                  <div className="flex-1 bg-slate-950 rounded-[10px] overflow-hidden flex flex-col text-[6px] text-slate-300">
                    <div className="h-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-1 flex items-center justify-between shrink-0 font-bold">
                      <span>ClSend</span>
                      <span className="w-1 h-1 rounded-full bg-white" />
                    </div>
                    <div className="p-1 space-y-1 flex-1">
                      <div className="bg-slate-900 rounded p-0.5 border border-slate-800 text-[5.5px]">
                        <p className="text-emerald-400 font-semibold truncate">{pick('Thiết bị đã kết nối', 'Device connected', '设备已连接')}</p>
                        <p className="text-slate-400 truncate">MacBook Pro M2</p>
                      </div>
                      <div className="bg-emerald-500/20 text-emerald-300 rounded p-0.5 text-[5px] truncate">
                        {pick('Sẵn sàng gửi tệp', 'Ready to send', '准备发送文件')}
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-around text-[5px] text-slate-400 shrink-0">
                      <span>{pick('Gửi', 'Send', '发送')}</span>
                      <span>{pick('Nhận', 'Receive', '接收')}</span>
                      <span>{pick('Chat', 'Chat', '聊天')}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer in Dark Theme */}
      <footer className="w-full py-6 text-center text-xs text-slate-500 border-t border-slate-900/80 bg-slate-950/60 backdrop-blur-xs">
        <p>
          {pickLang(
            currentLang,
            '© 2012 - 2026 Một sản phẩm của ClSend - ',
            '© 2012 - 2026 A product of ClSend - ',
            '© 2012 - 2026 ClSend 出品 - '
          )}
          {onOpenRules ? (
            <button
              type="button"
              onClick={onOpenRules}
              className="text-emerald-400 hover:underline cursor-pointer font-medium"
            >
              {pickLang(currentLang, 'Điều khoản & Bảo mật', 'Terms & Privacy', '条款与隐私')}
            </button>
          ) : (
            <span className="text-emerald-400">
              {pickLang(currentLang, 'Điều khoản & Bảo mật', 'Terms & Privacy', '条款与隐私')}
            </span>
          )}
        </p>
      </footer>
    </div>
  );
};
