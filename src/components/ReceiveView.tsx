import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage, pickLang } from '../context/LanguageContext';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { DirectTransfer, DeviceType } from './types';
import { 
  Download, 
  FileText, 
  Check, 
  X, 
  Copy, 
  Clock, 
  Laptop, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Radio, 
  Eye, 
  Trash2,
  CheckCircle2,
  Share2,
  Sparkles,
  Tv,
  Sliders,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Cloud,
  Database,
  Save,
  HardDrive,
  Filter,
  Search,
  FileCheck,
  CheckCheck,
  Layers,
  Inbox,
  ArrowDownCircle,
  HelpCircle,
  AlertCircle,
  Film,
  Play
} from 'lucide-react';
import { formatFileSize } from '../utils/device';
import { playReceiveSound } from '../utils/sound';
import { isImageFile, isVideoFile } from '../utils/fileUpload';
import { FileDocIcon, getDocumentTypeInfo } from './FileDocIcon';
import { extractUrls, hasUrls, renderClickableText } from '../utils/textFormat';
import { downloadFileSafely, openSafeExternalTab } from '../utils/fileDownload';
import { showGlobalToast } from '../utils/toast';
import { VideoPreviewPlayer } from './VideoPreviewPlayer';

type ReceiveCategoryTab = 'all' | 'files' | 'text' | 'saved_cloud' | 'pending';

function getFileCategory(mimeType: string, fileName: string): 'image' | 'video' | 'audio' | 'document' | 'other' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif'].includes(ext)) return 'image';
  if (mimeType.startsWith('video/') || ['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v', '3gp'].includes(ext)) return 'video';
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('excel') || mimeType.includes('document') || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) return 'document';
  return 'other';
}

const ReceiveViewComponent: React.FC = () => {
  const { currentUser, settings, updateSettings } = useAuth();
  const { t, currentLang } = useLanguage();
  const pick = <T,>(vi: T, en: T, zh: T): T => pickLang(currentLang, vi, en, zh);
  const [transfers, setTransfers] = useState<DirectTransfer[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ type: 'image' | 'video'; url: string; name?: string } | null>(null);
  const setPreviewImage = (url: string | null) => setPreviewMedia(url ? { type: 'image', url } : null);
  const previewImage = previewMedia?.type === 'image' ? previewMedia.url : null;
  const [downloadingIds, setDownloadingIds] = useState<Record<string, 'downloading' | 'done'>>({});
  const [savedCloudIds, setSavedCloudIds] = useState<Record<string, 'saving' | 'saved'>>({});
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isSavingAllToCloud, setIsSavingAllToCloud] = useState(false);
  
  // Tab Management in ReceiveView
  const [activeTab, setActiveTab] = useState<ReceiveCategoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auto-save toggle state (persisted locally)
  const [autoSaveToCloud, setAutoSaveToCloud] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('cloudsend_auto_save_cloud') === 'true';
  });

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const toggleAutoSaveToCloud = (enabled: boolean) => {
    setAutoSaveToCloud(enabled);
    localStorage.setItem('cloudsend_auto_save_cloud', enabled ? 'true' : 'false');
    showToast(
      enabled 
        ? pick('⚡ Đã BẬT tính năng Tự động lưu mọi tệp nhận vào Kho Cloud!', '⚡ Auto-save all received files to Cloud Drive ENABLED!', '⚡ 已开启接收文件自动保存到云盘！')
        : pick('Đã tắt tính năng tự động lưu vào Kho Cloud.', 'Auto-save to Cloud Drive disabled.', '已关闭自动保存到云盘。'),
      'info'
    );
  };

  // Helper for Toast alerts - routed to topmost persistent global toast
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    showGlobalToast(text, type);
  };

  // Lock background scroll when previewImage modal is open
  useEffect(() => {
    if (previewImage) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [previewImage]);

  // Listen to transfers directed to this user
  useEffect(() => {
    if (!currentUser) return;

    const transfersRef = collection(db, 'transfers');
    const q = query(
      transfersRef, 
      where('receiverId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: DirectTransfer[] = [];
      let hasNewPending = false;

      snapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as DirectTransfer;
        items.push(data);
        if (data.status === 'pending') {
          hasNewPending = true;
          // If autoAccept is enabled, automatically mark as accepted
          if (settings.autoAccept) {
            updateDoc(doc(db, 'transfers', docSnap.id), { status: 'completed' }).catch(console.error);
          }
        }
      });

      // Sort descending by createdAt
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (hasNewPending && settings.soundEnabled) {
        playReceiveSound();
      }

      setTransfers(items);
    }, (err) => {
      console.warn('Transfers listener notice:', err);
    });

    return () => unsubscribe();
  }, [currentUser, settings.autoAccept, settings.soundEnabled]);

  // Handle Accept
  const handleAccept = async (id: string) => {
    try {
      await updateDoc(doc(db, 'transfers', id), { status: 'completed' });
      if (settings.soundEnabled) {
        playReceiveSound();
      }
      showToast(pick('Đã chấp nhận tệp gửi đến!', 'Accepted incoming file!', '已接收传入文件！'), 'success');
    } catch (err) {
      console.error('Accept transfer error:', err);
    }
  };

  // Handle Decline: Xóa ngay lập tức khỏi hệ thống khi người nhận từ chối
  const handleDecline = async (id: string) => {
    setTransfers(prev => prev.filter(t => t.id !== id));
    showToast(pick('Đã từ chối và xóa tệp gửi đến.', 'Declined and removed incoming file.', '已拒绝并移除传入文件。'), 'info');
    try {
      await deleteDoc(doc(db, 'transfers', id));
    } catch (err) {
      console.error('Decline transfer error:', err);
    }
  };

  // Handle Delete Single
  const handleDelete = async (id: string) => {
    setTransfers(prev => prev.filter(t => t.id !== id));
    showToast(pick('Đã xóa mục khỏi lịch sử nhận.', 'Removed item from received history.', '已从接收记录中移除。'), 'info');
    try {
      await deleteDoc(doc(db, 'transfers', id));
    } catch (err) {
      console.error('Delete transfer error:', err);
    }
  };

  // Handle Clear All
  const handleClearAllTransfers = async () => {
    if (!currentUser || transfers.length === 0) return;
    setIsClearingAll(true);
    setTransfers([]);
    try {
      const batch = writeBatch(db);
      transfers.forEach((item) => {
        const docRef = doc(db, 'transfers', item.id);
        batch.delete(docRef);
      });
      await batch.commit();
      setShowClearConfirm(false);
      showToast(pick('Đã xóa sạch toàn bộ lịch sử nhận tệp!', 'Cleared all received history!', '已清空全部接收记录！'), 'success');
    } catch (err: any) {
      showToast(pick('Không thể xóa: {err}', 'Unable to delete: {err}', '无法删除：{err}').replace('{err}', err?.message || pick('Thử lại sau', 'Try again later', '请稍后重试')), 'error');
    } finally {
      setIsClearingAll(false);
    }
  };

  // Handle Copy Text
  const handleCopyText = (id: string, text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(pick('Đã sao chép nội dung vào bộ nhớ tạm!', 'Copied content to clipboard!', '已复制内容到剪贴板！'), 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle Download File Safely
  const handleDownloadFile = async (item: DirectTransfer) => {
    let fileSource = item.fileUrl || item.fileData;
    let name = item.fileName || 'cloudsend-file';

    if (!fileSource && item.textContent) {
      const textBlob = new Blob([item.textContent], { type: 'text/plain;charset=utf-8' });
      fileSource = URL.createObjectURL(textBlob);
      name = `${pick('Van_ban_', 'Text_', '文本_')}${Date.now()}.txt`;
    }

    if (!fileSource) {
      showToast(pick('Không tìm thấy nguồn tệp tin để tải về.', 'Cannot find file source to download.', '未找到可下载的文件来源。'), 'error');
      return;
    }

    const isTeraBox = item.isTeraBox || /terabox|1024tera|mirrobox|nephobox|teraboxapp/i.test(fileSource || '');
    if (isTeraBox) {
      openSafeExternalTab(fileSource);
      showToast(pick('Đang mở tệp trong TeraBox...', 'Opening file in TeraBox...', '正在 TeraBox 中打开文件...'), 'success');
      return;
    }

    setDownloadingIds(prev => ({ ...prev, [item.id]: 'downloading' }));
    const success = await downloadFileSafely(fileSource, name, undefined, [item.id]);
    if (success) {
      setDownloadingIds(prev => ({ ...prev, [item.id]: 'done' }));
      showToast(pick('Đã tải xuống "{name}" thành công!', 'Downloaded "{name}" successfully!', '已成功下载 “{name}”！').replace('{name}', name), 'success');
      setTimeout(() => {
        setDownloadingIds(prev => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }, 2500);
    } else {
      setDownloadingIds(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  // Save single item to Cloud Drive
  const handleSaveToCloudDrive = async (item: DirectTransfer) => {
    if (!currentUser) {
      showToast(pick('Vui lòng đăng nhập để lưu tệp vào Kho Cloud.', 'Please log in to save files to Cloud Drive.', '请登录以将文件保存到云盘。'), 'error');
      return;
    }

    setSavedCloudIds(prev => ({ ...prev, [item.id]: 'saving' }));

    try {
      const docId = `cf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const fileName = item.fileName || (item.textContent ? `${pick('Van_ban_', 'Text_', '文本_')}${Date.now()}.txt` : 'received_file.bin');
      const fileType = item.fileType || (item.textContent ? 'text/plain' : 'application/octet-stream');
      const category = getFileCategory(fileType, fileName);

      let fileUrl = item.fileUrl || item.fileData || '';
      let fileViewUrl = item.fileUrl ? item.fileUrl.replace('/api/files/download/', '/api/files/view/') : fileUrl;

      // For text snippets, create safe text data URL
      if (!item.fileUrl && !item.fileData && item.textContent) {
        fileUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(item.textContent)}`;
        fileViewUrl = fileUrl;
      }

      // Safety guard: ensure no gigantic strings are stored in Firestore properties
      const safeUrl = (fileUrl && fileUrl.length < 700000) ? fileUrl : '';
      const safeViewUrl = (fileViewUrl && fileViewUrl.length < 700000) ? fileViewUrl : safeUrl;
      const safeThumbnail = (item.fileData && item.fileData.length < 500000) ? item.fileData : null;

      await setDoc(doc(db, 'cloud_files', docId), {
        id: docId,
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userName: currentUser.displayName || settings.deviceName || pick('Người dùng', 'User', '用户'),
        name: fileName,
        size: item.fileSize || (item.textContent ? item.textContent.length : 0),
        type: fileType,
        url: safeUrl,
        viewUrl: safeViewUrl,
        thumbnail: safeThumbnail,
        category: category,
        isFavorite: false,
        createdAt: new Date().toISOString()
      });

      setSavedCloudIds(prev => ({ ...prev, [item.id]: 'saved' }));
      showToast(pick('✨ Đã lưu "{name}" vào Kho Cloud thành công!', '✨ Saved "{name}" to Cloud Drive successfully!', '✨ 已成功将 “{name}” 保存到云盘！').replace('{name}', fileName), 'success');
    } catch (err: any) {
      console.error('Save to cloud error:', err);
      setSavedCloudIds(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      showToast(pick('Lỗi khi lưu vào Cloud: {err}', 'Error saving to Cloud: {err}', '保存到云盘出错：{err}').replace('{err}', err.message || pick('Thử lại sau', 'Try again later', '请稍后重试')), 'error');
    }
  };

  // Save all items to Cloud Drive
  const handleSaveAllToCloudDrive = async () => {
    if (!currentUser) {
      showToast(pick('Vui lòng đăng nhập để lưu vào Kho Cloud.', 'Please log in to save files to Cloud Drive.', '请登录以将文件保存到云盘。'), 'error');
      return;
    }
    if (transfers.length === 0) return;

    setIsSavingAllToCloud(true);
    let successCount = 0;

    try {
      for (const item of transfers) {
        if (savedCloudIds[item.id] === 'saved') continue;
        const docId = `cf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const fileName = item.fileName || (item.textContent ? `${pick('Van_ban_', 'Text_', '文本_')}${Date.now()}.txt` : 'received_file.bin');
        const fileType = item.fileType || (item.textContent ? 'text/plain' : 'application/octet-stream');
        const category = getFileCategory(fileType, fileName);

        let fileUrl = item.fileUrl || item.fileData || '';
        let fileViewUrl = item.fileUrl ? item.fileUrl.replace('/api/files/download/', '/api/files/view/') : fileUrl;

        if (!item.fileUrl && !item.fileData && item.textContent) {
          fileUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(item.textContent)}`;
          fileViewUrl = fileUrl;
        }

        const safeUrl = (fileUrl && fileUrl.length < 700000) ? fileUrl : '';
        const safeViewUrl = (fileViewUrl && fileViewUrl.length < 700000) ? fileViewUrl : safeUrl;
        const safeThumbnail = (item.fileData && item.fileData.length < 500000) ? item.fileData : null;

        await setDoc(doc(db, 'cloud_files', docId), {
          id: docId,
          userId: currentUser.uid,
          userEmail: currentUser.email || '',
          userName: currentUser.displayName || settings.deviceName || pick('Người dùng', 'User', '用户'),
          name: fileName,
          size: item.fileSize || (item.textContent ? item.textContent.length : 0),
          type: fileType,
          url: safeUrl,
          viewUrl: safeViewUrl,
          thumbnail: safeThumbnail,
          category: category,
          isFavorite: false,
          createdAt: new Date().toISOString()
        });

        setSavedCloudIds(prev => ({ ...prev, [item.id]: 'saved' }));
        successCount++;
      }

      showToast(pick('✨ Đã lưu tất cả {count} tệp/văn bản vào Kho Cloud thành công!', '✨ Saved all {count} files/notes to Cloud Drive successfully!', '✨ 已成功将全部 {count} 个文件/文本保存到云盘！').replace('{count}', String(successCount)), 'success');
    } catch (err: any) {
      showToast(pick('Lỗi khi lưu vào Kho Cloud: {err}', 'Error saving to Cloud: {err}', '保存到云盘出错：{err}').replace('{err}', err.message || pick('Thử lại sau', 'Try again later', '请稍后重试')), 'error');
    } finally {
      setIsSavingAllToCloud(false);
    }
  };

  // Export history to JSON backup file
  const handleExportHistory = () => {
    if (transfers.length === 0) {
      showToast(pick('Chưa có lịch sử nhận dữ liệu để xuất.', 'No transfer history to export.', '暂无可导出的接收记录。'), 'info');
      return;
    }

    const historyData = transfers.map((t, idx) => ({
      stt: idx + 1,
      id: t.id,
      fileName: t.fileName || pick('Đoạn văn bản', 'Text snippet', '文本片段'),
      fileSize: t.fileSize ? formatFileSize(t.fileSize) : 'N/A',
      fileType: t.fileType || 'text',
      senderName: t.senderName || pick('Người gửi ẩn danh', 'Anonymous Sender', '匿名发送者'),
      senderDevice: t.senderDevice || pick('Thiết bị', 'Device', '设备'),
      createdAt: t.createdAt,
      status: t.status,
      textContent: t.textContent || '',
      fileUrl: t.fileUrl || ''
    }));

    const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudsend_history_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(pick('Đã sao lưu tệp lịch sử nhận (.json) thành công!', 'Backed up transfer history (.json) successfully!', '已成功备份接收记录（.json）！'), 'success');
  };

  // Filtered transfers by Tab and Search
  const filteredTransfers = useMemo(() => {
    return transfers.filter((item) => {
      // 1. Tab filter
      if (activeTab === 'files') {
        if (!item.fileName && !item.fileUrl && !item.fileData) return false;
      } else if (activeTab === 'text') {
        if (!item.textContent) return false;
      } else if (activeTab === 'saved_cloud') {
        if (savedCloudIds[item.id] !== 'saved') return false;
      } else if (activeTab === 'pending') {
        if (item.status !== 'pending') return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.fileName?.toLowerCase().includes(q);
        const matchText = item.textContent?.toLowerCase().includes(q);
        const matchSender = item.senderName?.toLowerCase().includes(q) || item.senderDevice?.toLowerCase().includes(q);
        if (!matchName && !matchText && !matchSender) return false;
      }

      return true;
    });
  }, [transfers, activeTab, searchQuery, savedCloudIds]);

  // Tab badge counts
  const tabCounts = useMemo(() => {
    return {
      all: transfers.length,
      files: transfers.filter(t => !!(t.fileName || t.fileUrl || t.fileData)).length,
      text: transfers.filter(t => !!t.textContent).length,
      saved_cloud: Object.values(savedCloudIds).filter(v => v === 'saved').length,
      pending: transfers.filter(t => t.status === 'pending').length,
    };
  }, [transfers, savedCloudIds]);

  // Total transferred size calculation
  const totalReceivedBytes = useMemo(() => {
    return transfers.reduce((acc, t) => acc + (t.fileSize || 0), 0);
  }, [transfers]);

  const isTv = settings.deviceType === 'tv' || settings.tvModeEnabled;

  return (
    <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in duration-150">
      
      {/* Smart TV Leanback Banner */}
      {isTv && (
        <div className="bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-teal-500/15 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
                <Tv className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                    {pick('Chế độ Smart TV (Truyền hình thông minh)', 'Smart TV Mode', '智能电视模式')}
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {pick('Đã tối ưu DPI', 'DPI Optimized', 'DPI 已优化')}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  {pick(
                    'Đã tự động tăng kích thước hiển thị chống mỏi mắt. Mở CloudSend trên Điện thoại/Máy tính và chọn "{device}" để gửi ảnh, video hoặc tệp lên TV này.',
                    'Optimized display sizing for TV screens. Open CloudSend on Phone/PC and select "{device}" to stream photos, videos or files to this TV.',
                    '已为电视屏幕优化显示尺寸。在手机/电脑上打开 CloudSend 并选择 “{device}” 即可发送照片、视频或文件到此电视。'
                  ).replace('{device}', settings.deviceName)}
                </p>
              </div>
            </div>

            {/* TV DPI Quick Zoom Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 self-start sm:self-auto shrink-0">
              <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
                <Sliders className="w-3 h-3 text-amber-400" />
                {pick('DPI TV:', 'TV DPI:', '电视 DPI：')}
              </span>
              {[
                { scale: 1.25, label: '125%' },
                { scale: 1.4, label: '140%' },
                { scale: 1.5, label: '150%' },
                { scale: 1.75, label: '175%' },
                { scale: 2.0, label: '200%' },
              ].map(({ scale, label }) => {
                const isSelected = Math.abs((settings.tvDpiScale || 1.4) - scale) < 0.05;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => updateSettings({ tvDpiScale: scale, tvModeEnabled: true })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-3 flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1">
              🎮 <strong>{pick('Điều khiển từ xa (Remote):', 'Remote Control:', '遥控器操作：')}</strong>{' '}
              {pick('Dùng phím Mũi tên [⬅️ ➡️] chuyển Tab, [OK] chọn nút, [Back] quay lại.', 'Use Arrow keys [⬅️ ➡️] to switch tabs, [OK] to select, [Back] to return.', '使用方向键 [⬅️ ➡️] 切换标签页，[OK] 确认选择，[返回] 返回。')}
            </span>
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              {pick('⚡ Tự động nhận tệp (Auto Accept) đang bật cho TV.', '⚡ Auto-accept incoming files is enabled for TV.', '⚡ 已为电视开启自动接收传入文件。')}
            </span>
          </div>
        </div>
      )}

      {/* Ready to Receive Status Card & Storage Quick Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div 
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white shadow-xl shrink-0 ring-2 ring-white/10"
              style={{ backgroundColor: settings.avatarColor }}
            >
              <Download className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                  {settings.deviceName}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <Radio className="w-3 h-3 animate-pulse" />
                  {t('receive.ready')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {t('receive.ready_sub')}
              </p>
            </div>
          </div>

          {/* Quick Storage & Auto Save toggles */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle 1: Auto Accept */}
            <div className="flex items-center gap-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/90 shadow-sm">
              <div className="text-left">
                <span className="text-xs font-bold text-white block">{t('receive.auto_accept')}</span>
                <span className="text-[10px] text-slate-400 block">{t('receive.auto_accept_sub')}</span>
              </div>
              <button
                id="toggle-quick-save-btn"
                type="button"
                onClick={() => updateSettings({ autoAccept: !settings.autoAccept })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.autoAccept ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.autoAccept ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Auto Save to Cloud */}
            <div className="flex items-center gap-3 bg-slate-950/70 p-3 rounded-2xl border border-sky-500/30 shadow-sm">
              <div className="text-left">
                <span className="text-xs font-bold text-sky-300 flex items-center gap-1">
                  <Cloud className="w-3.5 h-3.5 text-sky-400" />
                  {t('receive.auto_cloud')}
                </span>
                <span className="text-[10px] text-slate-400 block">{t('receive.auto_cloud_sub')}</span>
              </div>
              <button
                id="toggle-auto-cloud-btn"
                type="button"
                onClick={() => toggleAutoSaveToCloud(!autoSaveToCloud)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoSaveToCloud ? 'bg-sky-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    autoSaveToCloud ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Live Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">{t('receive.stat_total')}</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {transfers.length}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">{t('receive.stat_size')}</span>
            <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
              {formatFileSize(totalReceivedBytes)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">{t('receive.stat_saved')}</span>
            <span className="text-sm font-bold text-sky-300 font-mono mt-0.5 block">
              {tabCounts.saved_cloud}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">{t('receive.stat_pending')}</span>
            <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">
              {tabCounts.pending}
            </span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' 
            : toastMessage.type === 'error'
            ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
            : 'bg-slate-900/90 border-slate-700 text-slate-200'
        }`}>
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)} 
            className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* TABS & SEARCH BAR (DANH MỤC TAB NHẬN) */}
      {/* ============================================================ */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* 5 SUB-TABS LIKE IMAGE */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto no-scrollbar">
            {/* TAB 1: TẤT CẢ */}
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('receive.tab_all')}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'all' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}>
                {tabCounts.all}
              </span>
            </button>

            {/* TAB 2: TỆP TIN & ẢNH */}
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'files'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileDocIcon fileName="sample.pdf" size="sm" />
              <span>{t('receive.tab_files')}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'files' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}>
                {tabCounts.files}
              </span>
            </button>

            {/* TAB 3: VĂN BẢN & LIÊN KẾT */}
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'text'
                  ? 'bg-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{t('receive.tab_text')}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'text' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}>
                {tabCounts.text}
              </span>
            </button>

            {/* TAB 4: ĐÃ LƯU KHO CLOUD */}
            <button
              type="button"
              onClick={() => setActiveTab('saved_cloud')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'saved_cloud'
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-sky-300 hover:bg-slate-800'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('receive.tab_saved')}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'saved_cloud' ? 'bg-slate-950/30 text-slate-950' : 'bg-sky-950 text-sky-300 border border-sky-500/30'
              }`}>
                {tabCounts.saved_cloud}
              </span>
            </button>

            {/* TAB 5: CHỜ DUYỆT (NẾU CÓ) */}
            {tabCounts.pending > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-amber-400 hover:bg-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{t('receive.tab_pending')}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-amber-500 text-slate-950 animate-pulse">
                  {tabCounts.pending}
                </span>
              </button>
            )}
          </div>

          {/* SEARCH & ACTIONS */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('receive.search_placeholder')}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* SAVE ALL TO CLOUD BUTTON */}
            {transfers.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleSaveAllToCloudDrive}
                  disabled={isSavingAllToCloud}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-sky-700/60 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all active:scale-95 cursor-pointer"
                  title={t('receive.save_all')}
                >
                  {isSavingAllToCloud ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('receive.saved')}...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5" />
                      <span>{t('receive.save_all')}</span>
                    </>
                  )}
                </button>

                {/* EXPORT JSON */}
                <button
                  type="button"
                  onClick={handleExportHistory}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                  title={pick('Sao lưu dữ liệu lịch sử (.json)', 'Backup history (.json)', '备份接收记录 (.json)')}
                >
                  <Database className="w-4 h-4 text-teal-400" />
                </button>

                {/* CLEAR ALL BUTTON */}
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 transition-colors cursor-pointer"
                  title={pick('Xóa tất cả lịch sử nhận', 'Clear all received history', '清空全部接收记录')}
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Confirmation dialog for Clear All */}
        {showClearConfirm && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 space-y-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-200">
                <strong className="text-white block mb-0.5">{pick('Xác nhận xóa toàn bộ lịch sử nhận:', 'Confirm clearing all received history:', '确认清空全部接收记录：')}</strong>
                {pick(
                  'Hành động này sẽ xóa vĩnh viễn {count} mục nhận khỏi danh sách. Các tệp đã lưu vào Kho Cloud sẽ không bị ảnh hưởng.',
                  'This action will permanently remove {count} received item(s) from the list. Files already saved to Cloud Drive will not be affected.',
                  '此操作将从列表中永久删除 {count} 条接收记录，已保存到云盘的文件不受影响。'
                ).replace('{count}', String(transfers.length))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                {pick('Hủy', 'Cancel', '取消')}
              </button>
              <button
                type="button"
                onClick={handleClearAllTransfers}
                disabled={isClearingAll}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isClearingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{pick('Xác Nhận Xóa Hết', 'Confirm Clear All', '确认清空')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Transfer Item List */}
        {filteredTransfers.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-10 sm:p-14 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 text-slate-400 mx-auto flex items-center justify-center shadow-inner">
              <Download className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">
                {t('receive.empty_title')}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {t('receive.empty_sub')}
              </p>
            </div>
            
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-sky-300">
                <Cloud className="w-3.5 h-3.5 text-sky-400" />
                <span>{t('drive.desc')}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredTransfers.map((item) => {
              const isPending = item.status === 'pending';
              const isCompleted = item.status === 'completed';
              const isDeclined = item.status === 'declined';
              const hasFile = !!(item.fileData || item.fileUrl);
              const isImage = (item.fileType?.startsWith('image/') || isImageFile({ name: item.fileName, type: item.fileType })) && hasFile;
              const isVideo = (item.fileType?.startsWith('video/') || isVideoFile({ name: item.fileName, type: item.fileType })) && hasFile;
              const viewUrl = item.fileUrl ? item.fileUrl.replace('/api/files/download/', '/api/files/view/') : '';
              const mediaSrc = item.fileData || viewUrl || item.fileUrl;
              const imageSrc = mediaSrc;
              const isSavedInCloud = savedCloudIds[item.id] === 'saved';
              const isSavingInCloud = savedCloudIds[item.id] === 'saving';

              return (
                <div
                  key={item.id}
                  id={`transfer-item-${item.id}`}
                  className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 transition-all shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isPending 
                      ? 'border-emerald-500/50 bg-emerald-500/5' 
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Actual Image / Video Thumbnail or Document Icon */}
                    {isImage ? (
                      <div 
                        onClick={() => mediaSrc && setPreviewMedia({ type: 'image', url: mediaSrc, name: item.fileName })}
                        className="relative group/thumb cursor-pointer w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shrink-0 shadow-md hover:ring-2 hover:ring-emerald-500 transition-all"
                        title={pick('Nhấn để xem ảnh phóng to', 'Click to view enlarged image', '点击查看大图')}
                      >
                        <img 
                          src={mediaSrc} 
                          alt={item.fileName || pick('Ảnh', 'Image', '图片')} 
                          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      </div>
                    ) : isVideo ? (
                      <div 
                        onClick={() => mediaSrc && setPreviewMedia({ type: 'video', url: mediaSrc, name: item.fileName })}
                        className="relative group/thumb cursor-pointer w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-emerald-500/40 bg-black shrink-0 shadow-md hover:ring-2 hover:ring-emerald-400 transition-all flex items-center justify-center"
                        title={pick('Nhấn để phát video', 'Click to play video', '点击播放视频')}
                      >
                        <Film className="w-6 h-6 text-emerald-400" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                          <Play className="w-4 h-4 text-white fill-white drop-shadow" />
                        </div>
                      </div>
                    ) : item.fileName ? (
                      <FileDocIcon fileName={item.fileName} mimeType={item.fileType} size="md" />
                    ) : (
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800 text-teal-400 flex items-center justify-center shrink-0 border border-slate-700/50">
                        <Copy className="w-5 h-5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                          {item.fileName || pick('Đoạn văn bản / Liên kết', 'Text / Link', '文本 / 链接')}
                        </span>
                        {item.fileSize && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                            {formatFileSize(item.fileSize)}
                          </span>
                        )}
                        {isPending && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold animate-pulse">
                            {pick('Yêu cầu gửi tệp', 'Incoming transfer', '文件传输请求')}
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {pick('Đã nhận', 'Received', '已接收')}
                          </span>
                        )}
                        {isDeclined && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20 font-semibold">
                            {pick('Đã từ chối', 'Declined', '已拒绝')}
                          </span>
                        )}
                        {isSavedInCloud && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold flex items-center gap-1">
                            <Cloud className="w-3 h-3 text-sky-400" /> {pick('Đã lưu Kho Cloud', 'Saved to Cloud', '已存至云盘')}
                          </span>
                        )}
                        {(item.isTeraBox || /terabox|1024tera|mirrobox|nephobox|teraboxapp/i.test(item.fileUrl || '')) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold flex items-center gap-1">
                            <HardDrive className="w-3 h-3 text-blue-400" /> TeraBox 1TB
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span>{t('receive.from')} <strong className="text-slate-200">{item.senderDevice}</strong> ({item.senderName})</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>

                      {/* Image preview hint if image */}
                      {isImage && imageSrc && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewImage(imageSrc)}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            {t('receive.preview')}
                          </button>
                        </div>
                      )}

                      {/* Snippet preview if text */}
                      {item.textContent && (
                        <div 
                          className="mt-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap break-words max-h-36 overflow-y-auto leading-relaxed copyable-text select-text cursor-text"
                          data-copyable="true"
                        >
                          {renderClickableText(item.textContent, false)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                    {isPending ? (
                      <>
                        <button
                          id={`accept-transfer-${item.id}`}
                          type="button"
                          onClick={() => handleAccept(item.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {t('receive.accept')}
                        </button>
                        <button
                          id={`decline-transfer-${item.id}`}
                          type="button"
                          onClick={() => handleDecline(item.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium flex items-center gap-1 active:scale-95 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          {t('receive.reject')}
                        </button>
                      </>
                    ) : (
                      <>
                        {/* 1. NÚT LƯU VÀO KHO CLOUD */}
                        <button
                          type="button"
                          onClick={() => handleSaveToCloudDrive(item)}
                          disabled={isSavingInCloud || isSavedInCloud}
                          title={t('receive.save_cloud')}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer ${
                            isSavedInCloud
                              ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white'
                          }`}
                        >
                          {isSavingInCloud ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                              <span>{t('receive.saved')}...</span>
                            </>
                          ) : isSavedInCloud ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-sky-400 stroke-[3]" />
                              <span>{t('receive.saved')}</span>
                            </>
                          ) : (
                            <>
                              <Cloud className="w-3.5 h-3.5 text-sky-400" />
                              <span>{t('receive.save_cloud')}</span>
                            </>
                          )}
                        </button>

                        {/* Văn bản actions */}
                        {item.textContent && (
                          <>
                            {extractUrls(item.textContent).map((url, uIdx) => (
                              <a
                                key={uIdx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                                title={`URL: ${url}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Link</span>
                              </a>
                            ))}

                            <button
                              type="button"
                              onClick={() => handleCopyText(item.id, item.textContent)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              {copiedId === item.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">{t('receive.copied')}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>{t('receive.copy_text')}</span>
                                </>
                              )}
                            </button>
                          </>
                        )}

                        {/* File actions */}
                        {hasFile && (
                          <>
                            {isImage && imageSrc && (
                              <button
                                type="button"
                                onClick={() => setPreviewImage(imageSrc)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {t('receive.preview')}
                              </button>
                            )}
                            {(item.isTeraBox || /terabox|1024tera|mirrobox|nephobox|teraboxapp/i.test(item.fileUrl || '')) ? (
                              <a
                                href={item.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                                title={pick('Mở và tải tệp từ TeraBox', 'Open & download file from TeraBox', '在 TeraBox 中打开并下载')}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>{pick('Mở TeraBox (1TB)', 'Open TeraBox (1TB)', '打开 TeraBox (1TB)')}</span>
                              </a>
                            ) : (
                              <>
                                {isVideo && mediaSrc && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewMedia({ type: 'video', url: mediaSrc, name: item.fileName })}
                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                                    title={pick('Xem và phát video trực tiếp', 'Watch & play video directly', '直接播放观看视频')}
                                  >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                    <span>{pick('Xem video', 'Watch video', '观看视频')}</span>
                                  </button>
                                )}
                                <button
                                  id={`download-file-${item.id}`}
                                  type="button"
                                  onClick={() => handleDownloadFile(item)}
                                  disabled={downloadingIds[item.id] === 'downloading'}
                                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700/60 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                                >
                                  {downloadingIds[item.id] === 'downloading' ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      {t('receive.download')}...
                                    </>
                                  ) : downloadingIds[item.id] === 'done' ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-white" />
                                      {t('receive.saved')}
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-3.5 h-3.5" />
                                      {t('receive.download')}
                                    </>
                                  )}
                                </button>
                              </>
                            )}
                          </>
                        )}

                        <button
                          type="button"
                          title={pick('Xóa khỏi lịch sử', 'Remove from history', '从记录中移除')}
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Media Preview Modal (Image & Video) */}
      {previewMedia && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-sm"
          onClick={() => setPreviewMedia(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-3 sm:p-4 flex flex-col items-center shadow-2xl"
          >
            <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[80%]">
                {previewMedia.name || (previewMedia.type === 'video' ? pick('Phát video', 'Play video', '播放视频') : pick('Xem trước hình ảnh', 'Image preview', '图片预览'))}
              </span>
              <button
                onClick={() => setPreviewMedia(null)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750 transition-colors cursor-pointer"
                title={pick('Đóng xem trước', 'Close preview', '关闭预览')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {previewMedia.type === 'video' ? (
              <VideoPreviewPlayer 
                src={previewMedia.url} 
                fileName={previewMedia.name || 'Video'}
                onDownload={() => downloadFileSafely(previewMedia.url, previewMedia.name || 'video.mp4')}
              />
            ) : (
              <img 
                src={previewMedia.url} 
                alt={pick('Xem trước', 'Preview', '预览')} 
                className="max-w-full max-h-[75vh] rounded-xl object-contain mx-auto shadow-lg" 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ReceiveView = React.memo(ReceiveViewComponent);
