import React, { useState, useMemo } from 'react';
import { 
  Scale, 
  ArrowLeft, 
  Search, 
  ShieldCheck, 
  AlertTriangle, 
  Copy, 
  Check, 
  FileText, 
  Layers, 
  ExternalLink,
  ChevronDown,
  Sparkles,
  Printer,
  Share2
} from 'lucide-react';
import { OFFICIAL_TERMS_OF_SERVICE, MainArticle, SubClause } from '../data/officialTerms';
import { CloudSendLogo } from './CloudSendLogo';
import { SilkFabricBackground } from './SilkFabricBackground';
import { useLanguage } from '../context/LanguageContext';

interface TermsOfServicePageProps {
  onBack: () => void;
}

export const TermsOfServicePage: React.FC<TermsOfServicePageProps> = ({ onBack }) => {
  const { currentLang, setLanguage } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedClauseId, setCopiedClauseId] = useState<string | null>(null);

  // Filter clauses based on category & search query
  const filteredArticles = useMemo(() => {
    return OFFICIAL_TERMS_OF_SERVICE.map((article) => {
      // Category match
      const categoryMatch = selectedCategory === 'all' || article.category === selectedCategory || article.id === selectedCategory;
      if (!categoryMatch) return null;

      if (!searchQuery.trim()) return article;

      const q = searchQuery.toLowerCase().trim();
      const articleMatches = article.title.toLowerCase().includes(q) || article.summary.toLowerCase().includes(q) || article.articleNumber.toLowerCase().includes(q);

      const matchingClauses = article.subClauses.filter((clause) => {
        return (
          clause.clauseNumber.toLowerCase().includes(q) ||
          clause.title.toLowerCase().includes(q) ||
          clause.description.toLowerCase().includes(q) ||
          clause.penalty.toLowerCase().includes(q) ||
          clause.examples.some(ex => ex.toLowerCase().includes(q))
        );
      });

      if (articleMatches) return article;
      if (matchingClauses.length > 0) {
        return {
          ...article,
          subClauses: matchingClauses
        };
      }
      return null;
    }).filter(Boolean) as MainArticle[];
  }, [searchQuery, selectedCategory]);

  const totalClauses = useMemo(() => {
    return OFFICIAL_TERMS_OF_SERVICE.reduce((acc, curr) => acc + curr.subClauses.length, 0);
  }, []);

  const handleCopyCitation = (clause: SubClause, article: MainArticle) => {
    const citation = `[Trích dẫn ClSend: ${article.articleNumber} - Khoản ${clause.clauseNumber}: ${clause.title}]\nNội dung: ${clause.description}\nChế tài: ${clause.penalty}\nNguồn chính thức: ${window.location.origin}/?page=rules#clause-${clause.id}`;
    navigator.clipboard.writeText(citation);
    setCopiedClauseId(clause.id);
    setTimeout(() => setCopiedClauseId(null), 2500);
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'high':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'medium':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200 relative overflow-x-hidden">
      {/* Living Silk Wave Background */}
      <SilkFabricBackground className="fixed inset-0 pointer-events-none -z-10" intensity="subtle" showParticles={true} showGrid={false} />

      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-[#0b0f19]/90 backdrop-blur-md border-b border-slate-800/80 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-emerald-500/40 text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span>Quay lại ứng dụng</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800">
              <CloudSendLogo className="w-6 h-6 text-emerald-400" />
              <span className="font-bold text-white text-sm">ClSend Legal Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center rounded-xl bg-slate-900 border border-slate-700/80 p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  currentLang === 'vi'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tiếng Việt"
              >
                <span>🇻🇳</span>
                <span className="hidden sm:inline">Tiếng Việt</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  currentLang === 'en'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="English"
              >
                <span>🇬🇧</span>
                <span className="hidden sm:inline">English</span>
              </button>
            </div>

            <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold hidden sm:inline-block">
              {currentLang === 'en' ? 'v2.5 Issued 2026' : 'v2.5 Ban hành 2026'}
            </span>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-6">
        <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-emerald-950/40 border border-slate-800/90 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          
          <div className="max-w-3xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              <span>Văn Bản Pháp Lý & Quy Chuẩn Cộng Đồng Chính Thức</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Bộ Luật Điều Khoản Sử Dụng & An Toàn Dữ Liệu ClSend
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Căn cứ theo Luật An ninh mạng và các tiêu chuẩn bảo mật dữ liệu P2P quốc tế: Đây là bộ quy định có hiệu lực thi hành bắt buộc đối với mọi hoạt động truyền tệp, tải xuống, nhắn tin và lưu trữ đám mây trên hệ sinh thái ClSend.
            </p>

            {/* Quick Metrics */}
            <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{OFFICIAL_TERMS_OF_SERVICE.length} Điều khoản chính</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <span className="w-2 h-2 rounded-full bg-teal-400" />
                <span>{totalClauses} Khoản luật phân cấp (1.1, 1.2...)</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Cơ chế kháng cáo công bằng 48h</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-4 sm:py-6 space-y-6">
        
        {/* Search & Quick Category Filters */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-3">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo từ khóa: 1.1, xúc phạm, mã độc, lừa đảo, cloud, P2P, khiếu nại..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500/60 transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              Tất cả điều khoản
            </button>
            {OFFICIAL_TERMS_OF_SERVICE.map((art) => (
              <button
                key={art.id}
                type="button"
                onClick={() => setSelectedCategory(art.category)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === art.category
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                {art.articleNumber}: {art.categoryLabel}
              </button>
            ))}
          </div>
        </div>

        {/* List of Articles & SubClauses */}
        <div className="space-y-8">
          {filteredArticles.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Không tìm thấy điều khoản phù hợp</h3>
              <p className="text-xs text-slate-400">
                Thử tìm với từ khóa khác như "xúc phạm", "mã độc", "cloud", "1.1" hoặc chọn tab "Tất cả điều khoản".
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md"
              >
                Xem lại toàn bộ điều khoản
              </button>
            </div>
          ) : (
            filteredArticles.map((article) => (
              <div 
                key={article.id} 
                id={`article-${article.id}`}
                className="rounded-3xl bg-slate-900/70 border border-slate-800/90 shadow-xl overflow-hidden backdrop-blur-md transition-all hover:border-slate-700"
              >
                {/* Article Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs border border-emerald-500/30">
                        {article.articleNumber}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        • {article.categoryLabel}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                      {article.title}
                    </h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {article.summary}
                    </p>
                  </div>
                  
                  <span className="text-xs font-mono text-slate-500 self-start sm:self-center shrink-0">
                    {article.subClauses.length} Khoản luật
                  </span>
                </div>

                {/* SubClauses List (1.1, 1.2, 1.3...) */}
                <div className="p-4 sm:p-6 space-y-4">
                  {article.subClauses.map((clause) => (
                    <div 
                      key={clause.id}
                      id={`clause-${clause.id}`}
                      className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-emerald-500/30 transition-all space-y-3 group/clause"
                    >
                      {/* Clause Title & Badges */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-900">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-mono font-bold text-xs border border-emerald-500/30">
                            Khoản {clause.clauseNumber}
                          </span>
                          <h3 className="font-bold text-white text-sm sm:text-base">
                            {clause.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getSeverityStyle(clause.severity)}`}>
                            {clause.severityLabel}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => handleCopyCitation(clause, article)}
                            title="Sao chép trích dẫn điều khoản này"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-300 text-[11px] font-medium transition-colors border border-slate-800 cursor-pointer"
                          >
                            {copiedClauseId === clause.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Trích dẫn</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {clause.description}
                      </p>

                      {/* Prohibited Actions Checklist */}
                      {clause.examples && clause.examples.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Hành vi bị nghiêm cấm cụ thể:
                          </p>
                          <ul className="space-y-1 text-xs text-slate-300 pl-1">
                            {clause.examples.map((ex, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-rose-400 font-bold shrink-0">•</span>
                                <span>{ex}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Penalty Banner */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-2 text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          <strong className="text-amber-300">Biện pháp chế tài kỹ thuật: </strong>
                          <span className="text-slate-300">{clause.penalty}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Appeal and Legal Contact Section */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl text-center space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Kênh Hỗ Trợ Pháp Lý & Tiếp Nhận Kháng Cáo Chính Thức</span>
          </h3>
          <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
            Nếu bạn phát hiện nội dung độc hại trên phòng chat hoặc tài khoản của bạn bị hệ thống AI kiểm duyệt nhầm lẫn, vui lòng liên hệ trực tiếp Ban Quản Trị qua kênh chính thức.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400">
            <span>Kênh Hỗ Trợ & Khiếu Nại: </span>
            <strong className="text-white">support@clsend.app</strong>
          </div>
          <p className="text-[11px] text-slate-500">
            Thời hạn xử lý và phản hồi kết quả xem xét: Trong vòng 24 - 48 giờ làm việc kể từ thời điểm tiếp nhận.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-slate-500 border-t border-slate-900 bg-slate-950/80">
        <p>
          © 2012 - 2026 ClSend P2P Cloud Suite • Văn bản Điều khoản & Quy tắc An toàn có hiệu lực từ ngày 01/01/2026.
        </p>
      </footer>
    </div>
  );
};
