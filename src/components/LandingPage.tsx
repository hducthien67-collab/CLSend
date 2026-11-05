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
                Mobile & PC
              </span>
            </div>
          </div>

          {/* Clean Trimmed-Down Navigation Links */}
          <nav className="flex items-center gap-3.5 sm:gap-6 text-xs sm:text-sm font-semibold">
            {onOpenRules && (
              <button
                type="button"
                onClick={onOpenRules}
                className="text-slate-300 hover:text-emerald-400 tracking-wide transition-colors uppercase cursor-pointer hidden sm:inline-block"
              >
                Bảo Mật
              </button>
            )}

            {onOpenRules && (
              <button
                type="button"
                onClick={onOpenRules}
                className="text-slate-300 hover:text-emerald-400 tracking-wide transition-colors uppercase cursor-pointer hidden sm:inline-block"
              >
                Điều Khoản
              </button>
            )}

            {/* Quick Install button in header */}
            <button
              type="button"
              onClick={() => onOpenDownload(isMobile ? 'mobile' : 'pc')}
              className="text-xs sm:text-sm font-bold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 sm:hidden" />
              <span>{isMobile ? 'Tải Về Điện Thoại' : 'Tải App'}</span>
            </button>

            <button
              type="button"
              onClick={onEnterApp}
              className="text-emerald-400 hover:text-emerald-300 font-bold tracking-wide transition-colors uppercase cursor-pointer flex items-center gap-1 ml-1"
            >
              <span>{isLoggedIn ? 'Vào Ứng Dụng' : 'Đăng Nhập'}</span>
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
              <h1 className="text-2xl sm:text-3xl lg:text-[35px] font-extrabold text-white leading-[1.2] tracking-tight mb-2">
                {isMobile ? 'Tải ClSend Về Điện Thoại' : 'Tải ClSend Cho Máy Tính & Điện Thoại'}
              </h1>

              <p className="text-sm sm:text-base font-semibold text-slate-300 mb-6 sm:mb-8">
                {isMobile 
                  ? 'Cài đặt trực tiếp vào điện thoại Android & iPhone chỉ với 1-chạm' 
                  : 'Ứng dụng ClSend đã có mặt trên Windows, Mac OS, Android & iOS'}
              </p>

              {/* Checklist items with EMERALD GREEN checkmarks */}
              <ul className="space-y-3.5 mb-8 sm:mb-10 text-slate-200 text-xs sm:text-sm font-medium">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Gửi file, ảnh, video cực nhanh không giới hạn</span>
                </li>

                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Đồng bộ tức thì giữa Điện thoại & Máy tính</span>
                </li>

                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Tối ưu cho chat bảo mật và truyền tệp riêng tư P2P</span>
                </li>
              </ul>

              {/* Action Buttons: Tailored for 1-Click Mobile & PC */}
              {isMobile ? (
                /* Mobile Layout Buttons: 1-Click Mobile Primary Button */
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4">
                    {/* Button 1: Tải về điện thoại (1-Chạm) */}
                    <button
                      id="mobile-direct-install-cta-btn"
                      type="button"
                      onClick={handleMobileDownloadClick}
                      className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:from-emerald-600 active:to-teal-500 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-500/25 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                    >
                      <Smartphone className="w-5 h-5 stroke-[2.5] text-slate-950" />
                      <span>📲 Tải Về Điện Thoại (1-Chạm)</span>
                    </button>

                    {/* Button 2: Dùng bản web */}
                    <button
                      id="landing-use-web-btn"
                      type="button"
                      onClick={onEnterApp}
                      className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl border-2 border-emerald-500/80 hover:bg-emerald-500/15 text-emerald-400 hover:text-emerald-300 font-bold text-sm sm:text-base transition-all active:scale-[0.98] cursor-pointer bg-slate-900/80"
                    >
                      <Globe className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                      <span>{isLoggedIn ? 'Vào ứng dụng' : 'Dùng bản web'}</span>
                    </button>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => onOpenDownload('pc')}
                      className="text-xs text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>Hoặc xem cách cài đặt cho máy tính (PC / Windows / Mac)</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Desktop Layout Buttons: Both PC and Mobile Options */
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4 flex-wrap">
                  {/* Button 1: Tải về PC */}
                  <button
                    id="landing-download-pc-btn"
                    type="button"
                    onClick={() => onOpenDownload('pc')}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:from-emerald-700 active:to-teal-600 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-600/30 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    <span>Tải về PC</span>
                  </button>

                  {/* Button 2: Tải về điện thoại (QR Scan & 1-chạm) */}
                  <button
                    id="landing-download-mobile-btn"
                    type="button"
                    onClick={() => onOpenDownload('mobile')}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-750 text-emerald-300 hover:text-white font-bold text-sm sm:text-base border border-emerald-500/30 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                    <span>Tải về điện thoại</span>
                  </button>

                  {/* Button 3: Dùng bản web */}
                  <button
                    id="landing-use-web-btn"
                    type="button"
                    onClick={onEnterApp}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border-2 border-emerald-500/80 hover:bg-emerald-500/15 text-emerald-400 hover:text-emerald-300 font-bold text-sm sm:text-base transition-all active:scale-[0.98] cursor-pointer bg-slate-900/80"
                  >
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                    <span>{isLoggedIn ? 'Vào ứng dụng' : 'Dùng bản web'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: High Fidelity Laptop & Smartphone Showcase Mockup */}
            <div className="lg:col-span-6 xl:col-span-5 flex items-center justify-center relative mt-4 lg:mt-0 select-none pointer-events-none">
              <div className="relative w-full max-w-[420px] aspect-[4/3] flex items-center justify-center">
                
                {/* Laptop Mockup */}
                <div className="w-[85%] max-w-[340px] sm:max-w-[370px] flex flex-col items-center">
                  {/* Laptop Lid / Screen */}
                  <div className="w-full bg-slate-900 rounded-t-xl p-1.5 sm:p-2 border border-slate-700 shadow-2xl relative">
                    {/* Top camera dot */}
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-700" />
                    
                    {/* Screen View */}
                    <div className="w-full aspect-[16/10] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex flex-col text-[8px] sm:text-[9px] text-slate-300 font-sans">
                      {/* App Mock Header */}
                      <div className="h-4 sm:h-5 bg-slate-900 border-b border-slate-800 px-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded bg-emerald-500" />
                          <span className="font-bold text-white text-[7.5px]">ClSend Desktop</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[6.5px] text-slate-400">
                          <span className="text-emerald-400 font-semibold">• Trực tuyến</span>
                        </div>
                      </div>

                      {/* App Mock Content Body */}
                      <div className="flex-1 grid grid-cols-12 min-h-0">
                        {/* Sidebar */}
                        <div className="col-span-4 bg-slate-900/80 border-r border-slate-800/80 p-1 space-y-1">
                          <div className="px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold truncate flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />
                            Đức Thiện
                          </div>
                          <div className="px-1 py-0.5 rounded text-slate-400 truncate">
                            Nhóm Relay P2P
                          </div>
                          <div className="px-1 py-0.5 rounded text-slate-400 truncate">
                            Kho Cloud Drive
                          </div>
                        </div>

                        {/* Chat / Transfer area */}
                        <div className="col-span-8 bg-slate-950 p-1.5 flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="bg-slate-900 rounded p-1 text-[7px] max-w-[85%] border border-slate-800">
                              <p className="text-emerald-400 font-bold mb-0.5">Tệp tin hoàn tất</p>
                              <p className="text-slate-300 truncate">tailieu_congviec_2026.pdf (14.2 MB)</p>
                            </div>
                            <div className="bg-emerald-500/20 text-emerald-200 rounded p-1 text-[7px] max-w-[75%] ml-auto border border-emerald-500/30 text-right">
                              Đã nhận tệp siêu tốc qua P2P! ⚡
                            </div>
                          </div>

                          <div className="h-3 bg-slate-900 rounded border border-slate-800 px-1 flex items-center text-slate-500 text-[6.5px]">
                            Nhập tin nhắn hoặc thả tệp...
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Laptop Base / Deck */}
                  <div className="w-[110%] h-2.5 sm:h-3 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 rounded-b-lg border-t border-slate-700 shadow-xl relative flex justify-center">
                    <div className="w-12 sm:w-16 h-1 bg-slate-600 rounded-b" />
                  </div>
                </div>

                {/* Smartphone Mockup (Overlapping on bottom-left, exactly like Image 1) */}
                <div className="absolute -left-2 sm:-left-3 bottom-0 w-[80px] sm:w-[95px] aspect-[9/18] bg-slate-900 rounded-[16px] sm:rounded-[18px] p-1 border-[1.5px] border-slate-700 shadow-2xl flex flex-col">
                  {/* Dynamic Island / Notch */}
                  <div className="w-4 h-1 bg-black rounded-full mx-auto mb-1 shrink-0" />

                  {/* Phone Screen View */}
                  <div className="flex-1 bg-slate-950 rounded-[10px] overflow-hidden flex flex-col text-[6px] text-slate-300">
                    <div className="h-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-1 flex items-center justify-between shrink-0 font-bold">
                      <span>ClSend</span>
                      <span className="w-1 h-1 rounded-full bg-white" />
                    </div>
                    <div className="p-1 space-y-1 flex-1">
                      <div className="bg-slate-900 rounded p-0.5 border border-slate-800 text-[5.5px]">
                        <p className="text-emerald-400 font-semibold truncate">Thiết bị đã kết nối</p>
                        <p className="text-slate-400 truncate">MacBook Pro M2</p>
                      </div>
                      <div className="bg-emerald-500/20 text-emerald-300 rounded p-0.5 text-[5px] truncate">
                        Sẵn sàng gửi tệp
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-around text-[5px] text-slate-400 shrink-0">
                      <span>Gửi</span>
                      <span>Nhận</span>
                      <span>Chat</span>
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
          © 2012 - 2026 Một sản phẩm của ClSend -{' '}
          {onOpenRules ? (
            <button
              type="button"
              onClick={onOpenRules}
              className="text-emerald-400 hover:underline cursor-pointer font-medium"
            >
              Điều khoản sử dụng dịch vụ
            </button>
          ) : (
            <span className="text-emerald-400">Điều khoản sử dụng dịch vụ</span>
          )}
        </p>
      </footer>
    </div>
  );
};
