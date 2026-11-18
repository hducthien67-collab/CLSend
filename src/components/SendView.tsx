import React, { useState, useEffect, useRef, startTransition } from 'react';
import { yieldToMain } from '../utils/scheduler';
import { useAuth, getClientDeviceId } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  deleteDoc,
  doc,
  setDoc,
  getDocs,
  getDocsFromServer
} from 'firebase/firestore';
import { PresenceDevice, DeviceType } from './types';
import { 
  Send, 
  FileText, 
  Image as ImageIcon, 
  UploadCloud, 
  Laptop, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Tv,
  Globe, 
  Search, 
  Check, 
  AlertCircle,
  Copy,
  Radio,
  FileUp,
  RefreshCw,
  Sparkles,
  Trash2,
  Eye,
  X,
  Clock,
  CheckCircle2,
  Camera,
  Plus,
  Files,
  Cloud,
  Link as LinkIcon,
  ExternalLink,
  Folder,
  Clipboard,
  AlignLeft,
  Edit3,
  HardDrive,
  Film,
  Play
} from 'lucide-react';
import { formatFileSize } from '../utils/device';
import { playSendSound } from '../utils/sound';
import { censorProfanity } from '../utils/moderation';
import { extractUrls, hasUrls, renderClickableText } from '../utils/textFormat';
import { 
  uploadFileToServer, 
  generateImageThumbnail, 
  generateVideoThumbnail,
  compressImageForDirectTransfer,
  isImageFile,
  isVideoFile,
  fileToBase64,
  createClientFallbackFileInfo,
  MAX_FILE_SIZE, 
  MAX_FILE_SIZE_LABEL 
} from '../utils/fileUpload';
import { downloadFileSafely } from '../utils/fileDownload';
import { inspectFileSecurity } from '../utils/fileSecurity';
import { FileDocIcon, getDocumentTypeInfo } from './FileDocIcon';
import { CloudDrivePickerModal } from './CloudDrivePickerModal';
import { VideoPreviewPlayer } from './VideoPreviewPlayer';
import { SmoothSpaceTextarea } from './SmoothSpaceTextarea';
import { RichChatInput } from './RichChatInput';
import { CloudDriveFile } from './types';
import { useLanguage, pickLang } from '../context/LanguageContext';

export interface SendFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
  cloudUrl?: string;
  viewUrl?: string;
  thumbnail?: string;
  isFromCloud?: boolean;
  isUrlLink?: boolean;
  isTeraBox?: boolean;
}

const SendViewComponent: React.FC = () => {
  const { currentUser, userProfile, settings, updatePresence } = useAuth();
  const { t, currentLang } = useLanguage();
  const pick = <T,>(vi: T, en: T, zh: T): T => pickLang(currentLang, vi, en, zh);
  const activeAvatarUrl = settings.customAvatarUrl || userProfile?.customAvatarUrl || currentUser?.photoURL;
  const [onlineDevices, setOnlineDevices] = useState<PresenceDevice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [isRescanning, setIsRescanning] = useState(false);

  // File state (supports multiple local & Cloud Drive files seamlessly on both phone and PC)
  const [selectedFiles, setSelectedFiles] = useState<SendFileItem[]>([]);
  const [fileThumbnails, setFileThumbnails] = useState<{ [fileName: string]: string }>({});
  const [isCloudPickerOpen, setIsCloudPickerOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pendingAutoSendTargetRef = useRef<PresenceDevice | null>(null);

  // Quick choice modal when clicking a device without content
  const [showQuickChoiceModal, setShowQuickChoiceModal] = useState(false);
  const [targetDeviceForQuickChoice, setTargetDeviceForQuickChoice] = useState<PresenceDevice | null>(null);

  // Text message modal state (Nhập tin nhắn popup matching Image 1)
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [modalTextValue, setModalTextValue] = useState('');
  // URL / TeraBox input modal state
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlModalValue, setUrlModalValue] = useState('');
  const [urlCustomName, setUrlCustomName] = useState('');

  const handleUrlAdded = (urlToUse?: string, customTitle?: string) => {
    const finalUrl = (urlToUse !== undefined ? urlToUse : urlModalValue).trim();
    if (!finalUrl) return;
    let validUrl = finalUrl;
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
    }
    try {
      const urlObj = new URL(validUrl);
      const isTeraBox = /terabox|1024tera|mirrobox|nephobox|teraboxapp/i.test(urlObj.hostname);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/').filter(Boolean);
      const rawName = segments[segments.length - 1] || urlObj.hostname;
      const decodedName = decodeURIComponent(rawName);
      
      let fileName = (customTitle !== undefined ? customTitle : urlCustomName).trim();
      if (!fileName) {
        if (isTeraBox) {
          fileName = `TeraBox_File_${rawName.substring(0, 12)}`;
        } else {
          fileName = decodedName.includes('.') ? decodedName : `${urlObj.hostname}_link`;
        }
      }

      const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(validUrl);

      const newItem: SendFileItem = {
        id: `url_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: fileName,
        size: 0,
        type: isTeraBox ? 'application/x-terabox' : (isImage ? 'image/jpeg' : 'text/uri-list'),
        cloudUrl: validUrl,
        viewUrl: validUrl,
        thumbnail: isImage ? validUrl : undefined,
        isFromCloud: false,
        isUrlLink: true,
        isTeraBox: isTeraBox
      };
      setSelectedFiles(prev => [...prev, newItem]);
      setUrlModalValue('');
      setUrlCustomName('');
      setIsUrlModalOpen(false);
      setShowQuickChoiceModal(false);
      setStatusMessage(pick(
        '🔗 Đã thêm tệp {source}: {name}',
        '🔗 Added {source} file: {name}',
        '🔗 已添加 {source} 文件：{name}'
      ).replace('{source}', isTeraBox ? 'TeraBox 1TB' : pick('Cloud', 'Cloud', '云端')).replace('{name}', fileName));
      setTimeout(() => setStatusMessage(null), 3500);
    } catch {
      setStatusMessage(pick('⚠️ URL không hợp lệ. Vui lòng kiểm tra lại định dạng https://...', '⚠️ Invalid URL. Please check the format https://...', '⚠️ URL 无效，请检查格式 https://...'));
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // Text state
  const [textContent, setTextContent] = useState('');

  // Sending feedback
  const [sendingTargetId, setSendingTargetId] = useState<string | null>(null);
  const [transferStatus, setTransferStatus] = useState<{ [peerId: string]: 'idle' | 'sending' | 'success' | 'error' }>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sent history and modal
  const [sentTransfers, setSentTransfers] = useState<any[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingVideo, setViewingVideo] = useState<SendFileItem | null>(null);

  // Lock body & container scroll when modals are open to prevent background scrolling
  useEffect(() => {
    if (isTextModalOpen || showQuickChoiceModal || isCloudPickerOpen || viewingImage || viewingVideo || isUrlModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');

      const preventBackgroundScroll = (e: Event) => {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'TEXTAREA' || target.closest('textarea') || target.closest('.modal-scrollable-content'))) {
          return;
        }
        e.preventDefault();
      };

      window.addEventListener('wheel', preventBackgroundScroll, { passive: false });
      window.addEventListener('touchmove', preventBackgroundScroll, { passive: false });

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.classList.remove('modal-open');
        window.removeEventListener('wheel', preventBackgroundScroll);
        window.removeEventListener('touchmove', preventBackgroundScroll);
      };
    }
  }, [isTextModalOpen, showQuickChoiceModal, isCloudPickerOpen, viewingImage, viewingVideo, isUrlModalOpen]);

  // Cached raw presence docs ref for periodic 5s freshness ticker
  const latestPresenceDocsRef = useRef<any[]>([]);

  // Core processing function: deduplicates devices by deviceId and purges stale/offline records
  const processPresenceDocs = (
    docs: any[],
    currentDevId: string,
    currentUid: string
  ) => {
    const now = Date.now();
    let myServerTime = 0;
    for (const docSnap of docs) {
      const d = docSnap.data({ serverTimestamps: 'estimate' });
      if (d.deviceId === currentDevId) {
        myServerTime = d.lastSeenServer?.toMillis?.() || 
          (d.lastSeenServer?.seconds ? d.lastSeenServer.seconds * 1000 : 0) || 
          d.lastSeenMs || 0;
      }
    }
    const referenceTime = myServerTime > 0 ? myServerTime : now;

    // Map by physical device ID (or uid if deviceId missing) to deduplicate devices
    const deviceMap = new Map<string, PresenceDevice & { id: string; peerTime: number }>();
    const toPurgeDocIds: string[] = [];

    for (const docSnap of docs) {
      const raw = docSnap.data({ serverTimestamps: 'estimate' });
      const data = { id: docSnap.id, ...raw } as PresenceDevice & { id: string };

      // Ignore this exact same browser instance
      if (data.deviceId && data.deviceId === currentDevId) continue;
      if (!data.deviceId && data.uid === currentUid) continue;

      // Skip explicitly offline
      if (data.status === 'offline') {
        toPurgeDocIds.push(docSnap.id);
        continue;
      }

      const peerTime = data.lastSeenServer?.toMillis?.() || 
        (data.lastSeenServer?.seconds ? data.lastSeenServer.seconds * 1000 : 0) || 
        data.lastSeenMs || 
        (data.lastSeen ? new Date(data.lastSeen).getTime() : 0);

      // If timestamp is 0, NaN, or completely missing -> stale legacy record -> purge
      if (!peerTime || isNaN(peerTime)) {
        toPurgeDocIds.push(docSnap.id);
        continue;
      }

      const diff = Math.abs(referenceTime - peerTime);

      // Thời gian sống của web/thiết bị là 3 phút (180.000ms) chuẩn như Facebook
      // Trong vòng 3 phút nếu client không có heartbeat phản hồi mới chấp nhận là offline!
      const PRESENCE_LIFETIME_MS = 180000; // 3 phút = 180.000 ms
      if (diff > PRESENCE_LIFETIME_MS) {
        toPurgeDocIds.push(docSnap.id);
        continue;
      }

      // Valid online device: deduplicate by deviceId or uid
      const key = data.deviceId || data.uid;
      const existing = deviceMap.get(key);
      if (!existing || peerTime > existing.peerTime) {
        if (existing) {
          toPurgeDocIds.push(existing.id);
        }
        deviceMap.set(key, { ...data, peerTime });
      } else {
        toPurgeDocIds.push(docSnap.id);
      }
    }

    // Auto-clean dead records from Firestore
    toPurgeDocIds.forEach((id) => {
      deleteDoc(doc(db, 'presence', id)).catch(() => {});
    });

    const liveDevices: PresenceDevice[] = [];
    deviceMap.forEach((data) => {
      if (data.uid === currentUid) {
        liveDevices.push({
          ...data,
          displayName: `${data.displayName} ${pick('(Thiết bị khác của bạn)', '(Your other device)', '(您的另一台设备)')}`
        });
      } else {
        liveDevices.push(data);
      }
    });

    return { liveDevices, toPurgeDocIds };
  };

  // Real-time listener for online presence across Internet
  useEffect(() => {
    if (!currentUser) return;

    const currentDevId = getClientDeviceId();
    const presenceRef = collection(db, 'presence');

    const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
      latestPresenceDocsRef.current = snapshot.docs;
      const { liveDevices } = processPresenceDocs(snapshot.docs, currentDevId, currentUser.uid);

      setOnlineDevices((prev) => {
        if (prev.length === liveDevices.length) {
          const isIdentical = prev.every((p, i) => 
            p.uid === liveDevices[i]?.uid &&
            p.deviceId === liveDevices[i]?.deviceId &&
            p.displayName === liveDevices[i]?.displayName &&
            p.deviceName === liveDevices[i]?.deviceName &&
            p.deviceType === liveDevices[i]?.deviceType &&
            p.avatarColor === liveDevices[i]?.avatarColor &&
            p.customAvatarUrl === liveDevices[i]?.customAvatarUrl &&
            p.connectCode === liveDevices[i]?.connectCode &&
            p.status === liveDevices[i]?.status
          );
          if (isIdentical) return prev;
        }
        return liveDevices;
      });
    }, (error) => {
      console.warn('Presence listener notice:', error);
    });

    // Background freshness ticker: runs continuously without pausing
    const tickerInterval = setInterval(() => {
      if (latestPresenceDocsRef.current.length > 0) {
        const { liveDevices } = processPresenceDocs(latestPresenceDocsRef.current, currentDevId, currentUser.uid);
        setOnlineDevices((prev) => {
          if (prev.length === liveDevices.length) {
            const isIdentical = prev.every((p, i) => 
              p.uid === liveDevices[i]?.uid &&
              p.deviceId === liveDevices[i]?.deviceId &&
              p.displayName === liveDevices[i]?.displayName &&
              p.deviceName === liveDevices[i]?.deviceName &&
              p.deviceType === liveDevices[i]?.deviceType &&
              p.avatarColor === liveDevices[i]?.avatarColor &&
              p.customAvatarUrl === liveDevices[i]?.customAvatarUrl &&
              p.connectCode === liveDevices[i]?.connectCode &&
              p.status === liveDevices[i]?.status
            );
            if (isIdentical) return prev;
          }
          return liveDevices;
        });
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(tickerInterval);
    };
  }, [currentUser]);

  // Real-time listener for transfers sent by this user
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'transfers'),
      where('senderId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSentTransfers(items.slice(0, 10));
    }, (err) => {
      console.warn('Sent transfers listener notice:', err);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Global paste handler: allows Ctrl+V anywhere on the Send view
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // If user is typing inside an input/textarea element, let the element handle it natively
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.clipboardData) {
        // 1. Check for files / images first
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          e.preventDefault();
          handleFilesAdded(e.clipboardData.files);
          setMode('file');
          setStatusMessage(pick(
            '📋 Đã nhận {count} tệp từ phím tắt Ctrl+V.',
            '📋 Received {count} file(s) from Ctrl+V.',
            '📋 已通过 Ctrl+V 接收 {count} 个文件。'
          ).replace('{count}', String(e.clipboardData.files.length)));
          setTimeout(() => setStatusMessage(null), 3500);
          return;
        }

        // 2. Check for text
        const text = e.clipboardData.getData('text');
        if (text && text.trim()) {
          e.preventDefault();
          setTextContent(text);
          setMode('text');
          setStatusMessage(pick(
            '📋 Đã nhận văn bản từ phím tắt Ctrl+V.',
            '📋 Received text from Ctrl+V.',
            '📋 已通过 Ctrl+V 接收文本内容。'
          ));
          setTimeout(() => setStatusMessage(null), 3500);
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [currentLang]);

  // Global drag & drop handler for the entire window
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFilesAdded(e.dataTransfer.files);
        setMode('file');
        setStatusMessage(pick(
          '📂 Đã nhận {count} tệp kéo thả vào vùng gửi.',
          '📂 Received {count} dropped file(s) in send area.',
          '📂 已接收拖放到发送区的 {count} 个文件。'
        ).replace('{count}', String(e.dataTransfer.files.length)));
        setTimeout(() => setStatusMessage(null), 3500);
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [currentLang]);

  // Handle file addition (supports multiple files from local disk with strict security checks)
  const handleFilesAdded = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const validFiles: File[] = [];
    const blockedFiles: string[] = [];

    for (const f of incoming) {
      const sec = inspectFileSecurity(f);
      if (!sec.isSafe) {
        blockedFiles.push(f.name);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        setStatusMessage(pick(
          'Tệp "{name}" ({size}) vượt quá giới hạn tối đa {limit}.',
          'File "{name}" ({size}) exceeds maximum limit of {limit}.',
          '文件 “{name}” ({size}) 超过了最大限制 {limit}。'
        ).replace('{name}', f.name).replace('{size}', formatFileSize(f.size)).replace('{limit}', MAX_FILE_SIZE_LABEL));
      } else {
        validFiles.push(f);
      }
    }

    if (blockedFiles.length > 0) {
      setStatusMessage(pick(
        '🚫 Đã từ chối {count} tệp [{names}] vì chứa định dạng nguy hiểm.',
        '🚫 Rejected {count} file(s) [{names}] due to unsafe file format.',
        '🚫 因包含不安全格式，已拒绝 {count} 个文件 [{names}]。'
      ).replace('{count}', String(blockedFiles.length)).replace('{names}', blockedFiles.slice(0, 2).join(', ')));
    }

    if (validFiles.length === 0) return;

    if (blockedFiles.length === 0) {
      setStatusMessage(null);
    }

    const newItems: SendFileItem[] = validFiles.map((file) => ({
      id: `local_${file.name}_${file.size}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      file: file,
      isFromCloud: false
    }));

    setSelectedFiles(prev => {
      const existingKeys = new Set(prev.map(p => `${p.name}_${p.size}`));
      const nonDuplicates = newItems.filter(f => !existingKeys.has(`${f.name}_${f.size}`));
      return [...prev, ...nonDuplicates];
    });

    // Generate thumbnails for image & video files
    for (const file of validFiles) {
      if (isImageFile(file)) {
        try {
          const thumb = await generateImageThumbnail(file, 480, 0.75);
          if (thumb) {
            setFileThumbnails(prev => ({ ...prev, [file.name]: thumb }));
          }
        } catch {
          // ignore thumbnail errors
        }
      } else if (isVideoFile(file)) {
        try {
          const thumb = await generateVideoThumbnail(file);
          if (thumb) {
            setFileThumbnails(prev => ({ ...prev, [file.name]: thumb }));
          }
        } catch {
          // ignore video thumbnail errors
        }
      }
    }

    // Tự động gửi ngay lập tức tới thiết bị đã chọn nếu được kích hoạt qua 1-click
    if (pendingAutoSendTargetRef.current) {
      const autoTarget = pendingAutoSendTargetRef.current;
      pendingAutoSendTargetRef.current = null;
      setTimeout(() => {
        sendToPeer(autoTarget, newItems);
      }, 120);
    }
  };

  // Handle files selected from Cloud Drive
  const handleCloudFilesAdded = (chosen: CloudDriveFile[]) => {
    if (!chosen.length) return;

    const newItems: SendFileItem[] = chosen.map((cf) => ({
      id: `cloud_${cf.id}`,
      name: cf.name,
      size: cf.size,
      type: cf.type,
      cloudUrl: cf.url,
      viewUrl: cf.viewUrl,
      thumbnail: cf.thumbnail,
      isFromCloud: true
    }));

    setSelectedFiles(prev => {
      const existingKeys = new Set(prev.map(p => `${p.name}_${p.size}`));
      const nonDuplicates = newItems.filter(f => !existingKeys.has(`${f.name}_${f.size}`));
      return [...prev, ...nonDuplicates];
    });

    const newThumbs: { [fileName: string]: string } = {};
    for (const cf of chosen) {
      if (cf.thumbnail) {
        newThumbs[cf.name] = cf.thumbnail;
      } else if ((isImageFile(cf) || isVideoFile(cf)) && (cf.viewUrl || cf.url)) {
        newThumbs[cf.name] = cf.viewUrl || cf.url;
      }
    }
    setFileThumbnails(prev => ({ ...prev, ...newThumbs }));
    setStatusMessage(pick(
      'Đã thêm {count} tệp từ Kho Cloud vào danh sách gửi.',
      'Added {count} file(s) from Cloud Drive to send list.',
      '已从云盘添加 {count} 个文件到发送列表。'
    ).replace('{count}', String(newItems.length)));
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAllFiles = () => {
    setSelectedFiles([]);
    setFileThumbnails({});
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
      return;
    }
    // Support dragging and dropping links (including TeraBox, Google Drive, direct links)
    const droppedUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (droppedUrl && droppedUrl.trim().startsWith('http')) {
      handleUrlAdded(droppedUrl.trim());
    }
  };

  // Handle Paste from Clipboard (Images, Files, TeraBox Links or Text)
  const handlePasteAction = async () => {
    // Check if Clipboard API is supported
    if (!navigator.clipboard) {
      setStatusMessage(pick(
        'ℹ️ Trình duyệt chưa hỗ trợ đọc trực tiếp. Bạn hãy nhấn phím Ctrl + V để dán ngay.',
        'ℹ️ Browser does not support direct clipboard reading. Press Ctrl + V to paste.',
        'ℹ️ 浏览器不支持直接读取剪贴板，请按 Ctrl + V 粘贴。'
      ));
      setTimeout(() => setStatusMessage(null), 4500);
      return;
    }

    try {
      // 1. Try reading rich media (images / files)
      if (navigator.clipboard.read) {
        try {
          const items = await navigator.clipboard.read();
          const files: File[] = [];
          for (const item of items) {
            for (const type of item.types) {
              if (type.startsWith('image/') || type.startsWith('application/')) {
                const blob = await item.getType(type);
                const ext = type.split('/')[1]?.split('+')[0] || 'png';
                const file = new File([blob], `clipboard_${Date.now()}.${ext}`, { type });
                files.push(file);
              }
            }
          }
          if (files.length > 0) {
            handleFilesAdded(files);
            setMode('file');
            setStatusMessage(pick(
              '📋 Đã dán thành công {count} ảnh/tệp từ bộ nhớ tạm!',
              '📋 Successfully pasted {count} image(s)/file(s) from clipboard!',
              '📋 已成功从剪贴板粘贴 {count} 个图片/文件！'
            ).replace('{count}', String(files.length)));
            setTimeout(() => setStatusMessage(null), 3500);
            return;
          }
        } catch (mediaErr: any) {
          console.log('Clipboard rich media read notice:', mediaErr?.message);
        }
      }

      // 2. Try reading plain text / TeraBox link / URLs
      if (navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const cleanText = text.trim();
          // Detect if pasted text is a TeraBox link or any cloud file link
          const isUrl = /^https?:\/\//i.test(cleanText);
          const isTeraBox = /terabox|1024tera|mirrobox|nephobox|teraboxapp/i.test(cleanText);

          if (isUrl && (isTeraBox || cleanText.includes('/s/'))) {
            handleUrlAdded(cleanText);
            return;
          }

          setTextContent(text);
          setMode('text');
          setStatusMessage(pick(
            '📋 Đã dán thành công nội dung văn bản từ bộ nhớ tạm!',
            '📋 Successfully pasted text content from clipboard!',
            '📋 已成功从剪贴板粘贴文本内容！'
          ));
          setTimeout(() => setStatusMessage(null), 3500);
          return;
        }
      }

      setStatusMessage(pick(
        '⚠️ Bộ nhớ tạm hiện đang trống. Hãy sao chép nội dung rồi nhấn Dán hoặc Ctrl+V.',
        '⚠️ Clipboard is currently empty. Copy some content then click Paste or press Ctrl+V.',
        '⚠️ 剪贴板当前为空，请先复制内容后再点击粘贴或按 Ctrl+V。'
      ));
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.warn('Clipboard read permission error:', err);
      // Detailed explanation for why the browser prevented reading
      const isDenied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError' || String(err?.message || '').toLowerCase().includes('denied') || String(err?.message || '').toLowerCase().includes('permission');
      if (isDenied) {
        setStatusMessage(pick(
          '🔒 Trình duyệt đã chặn quyền đọc bộ nhớ tạm. Hãy chọn "Cho phép" (Allow) trên thanh địa chỉ, hoặc bấm Ctrl+V để dán trực tiếp.',
          '🔒 Browser has blocked clipboard access. Please select "Allow" in the address bar, or press Ctrl+V to paste directly.',
          '🔒 浏览器拦截了剪贴板权限。请在地址栏选择“允许”，或直接按 Ctrl+V 粘贴。'
        ));
      } else {
        setStatusMessage(pick(
          '💡 Nhấn phím Ctrl + V (hoặc Cmd + V) trên bàn phím để dán nội dung ngay lập tức.',
          '💡 Press Ctrl + V (or Cmd + V) on your keyboard to paste content immediately.',
          '💡 按键盘上的 Ctrl + V（或 Cmd + V）即可立即粘贴内容。'
        ));
      }
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Text Modal Handlers (Nhập tin nhắn modal matching Image 1)
  const handleOpenTextModal = (initialText?: string, targetDevice?: PresenceDevice) => {
    setModalTextValue(initialText !== undefined ? initialText : textContent);
    if (targetDevice) {
      setTargetDeviceForQuickChoice(targetDevice);
    }
    setIsTextModalOpen(true);
  };

  const handleConfirmTextModal = () => {
    const clean = modalTextValue.trim();
    setTextContent(modalTextValue);
    setIsTextModalOpen(false);

    if (targetDeviceForQuickChoice && clean) {
      sendDirectTextToPeer(targetDeviceForQuickChoice, modalTextValue);
      setTargetDeviceForQuickChoice(null);
    } else if (clean) {
      setStatusMessage(pick(
        '✓ Đã chuẩn bị tin nhắn văn bản. Chọn thiết bị bên dưới để gửi!',
        '✓ Text message ready. Select a device below to send!',
        '✓ 文本消息已就绪，请在下方选择设备发送！'
      ));
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // Direct send text to a target peer
  const sendDirectTextToPeer = async (target: PresenceDevice, textToSend: string) => {
    if (!currentUser || !textToSend.trim()) return;

    setSendingTargetId(target.uid);
    setTransferStatus(prev => ({ ...prev, [target.uid]: 'sending' }));
    setStatusMessage(null);
    await yieldToMain();

    try {
      const payload: any = {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || pick('Người dùng', 'User', '用户'),
        senderDevice: settings.deviceName,
        receiverId: target.uid,
        receiverName: target.displayName || target.deviceName,
        status: 'pending',
        createdAt: new Date().toISOString(),
        textContent: censorProfanity(textToSend.trim()).cleanText
      };
      await addDoc(collection(db, 'transfers'), payload);

      if (settings.soundEnabled) {
        playSendSound();
      }

      setTransferStatus(prev => ({ ...prev, [target.uid]: 'success' }));
      setStatusMessage(pick(
        'Đã gửi tin nhắn thành công đến {device}!',
        'Message sent successfully to {device}!',
        '已成功向 {device} 发送消息！'
      ).replace('{device}', target.deviceName));
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      console.error('Send text error:', err);
      setTransferStatus(prev => ({ ...prev, [target.uid]: 'error' }));
      setStatusMessage(pick(
        'Lỗi khi gửi tin nhắn. Vui lòng thử lại.',
        'Error sending message. Please try again.',
        '发送消息失败，请重试。'
      ));
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setSendingTargetId(null);
      setTimeout(() => {
        setTransferStatus(prev => ({ ...prev, [target.uid]: 'idle' }));
      }, 3000);
    }
  };

  // Check if content is ready or open direct file picker for instant 1-click send
  const handleDeviceClick = (target: PresenceDevice) => {
    const hasFiles = selectedFiles.length > 0;
    const hasText = textContent.trim().length > 0;

    if (!hasFiles && !hasText) {
      pendingAutoSendTargetRef.current = target;
      setStatusMessage(pick(
        '📁 Hãy chọn tệp để gửi trực tiếp tới {device}...',
        '📁 Select file to send directly to {device}...',
        '📁 请选择要直接发送到 {device} 的文件...'
      ).replace('{device}', target.deviceName));
      fileInputRef.current?.click();
      return;
    }

    sendToPeer(target);
  };

  // Perform send to target device (files, text, or both)
  const sendToPeer = async (target: PresenceDevice, overrideFiles?: SendFileItem[]) => {
    if (!currentUser) return;
    const targetFiles = (overrideFiles && overrideFiles.length > 0) ? overrideFiles : selectedFiles;
    const hasFiles = targetFiles.length > 0;
    const hasText = textContent.trim().length > 0;

    if (!hasFiles && !hasText) {
      setStatusMessage(pick(
        'Vui lòng chọn tệp tin hoặc nhập văn bản cần gửi.',
        'Please select files or enter text to send.',
        '请选择文件或输入要发送的文本。'
      ));
      return;
    }

    setSendingTargetId(target.uid);
    setTransferStatus(prev => ({ ...prev, [target.uid]: 'sending' }));
    setStatusMessage(null);
    await yieldToMain();

    try {
      if (hasFiles) {
        const totalFiles = targetFiles.length;
        for (let i = 0; i < totalFiles; i++) {
          const item = targetFiles[i];
          const currentNumber = i + 1;
          
          let currentDisplayPct = Math.min(92, Math.round((i / totalFiles) * 100) + 5);
          setUploadProgress(currentDisplayPct);
          const progressInterval = setInterval(() => {
            currentDisplayPct += Math.floor(Math.random() * 5) + 2;
            if (currentDisplayPct > 92) currentDisplayPct = 92;
            setUploadProgress(currentDisplayPct);
          }, 150);

          setUploadProgressText(pick(
            'Đang xử lý tệp {current}/{total}: "{name}"...',
            'Processing file {current}/{total}: "{name}"...',
            '正在处理文件 {current}/{total}：“{name}”...'
          ).replace('{current}', String(currentNumber)).replace('{total}', String(totalFiles)).replace('{name}', item.name));

          let fileUrl = '';
          let serverThumbnail = fileThumbnails[item.name] || item.thumbnail || '';

          if ((item.isFromCloud || item.isUrlLink) && item.cloudUrl) {
            clearInterval(progressInterval);
            // Stored in Cloud Drive or external TeraBox / URL
            fileUrl = item.cloudUrl;
            const fileShare = 100 / totalFiles;
            const overall = Math.min(99, Math.round((i + 1) * fileShare));
            setUploadProgress(overall);
            setUploadProgressText(pick(
              'Đã chuẩn bị tệp {source} {current}/{total}: "{name}"...',
              'Prepared {source} file {current}/{total}: "{name}"...',
              '已准备好 {source} 文件 {current}/{total}：“{name}”...'
            ).replace('{source}', item.isTeraBox ? 'TeraBox' : pick('Cloud', 'cloud', '云端')).replace('{current}', String(currentNumber)).replace('{total}', String(totalFiles)).replace('{name}', item.name));
          } else if (item.file) {
            // Local file: upload to server
            try {
              const uploaded = await uploadFileToServer(item.file, (pct) => {
                const fileShare = 100 / totalFiles;
                const overall = Math.min(99, Math.round(i * fileShare + (pct / 100) * fileShare));
                setUploadProgress(overall);
                setUploadProgressText(pick(
                  'Đang gửi tệp {current}/{total}: "{name}" ({pct}%)...',
                  'Sending file {current}/{total}: "{name}" ({pct}%)...',
                  '正在发送文件 {current}/{total}：“{name}” ({pct}%)...'
                ).replace('{current}', String(currentNumber)).replace('{total}', String(totalFiles)).replace('{name}', item.name).replace('{pct}', String(pct)));
              });
              clearInterval(progressInterval);
              fileUrl = uploaded.url;
              if (uploaded.thumbnail) {
                serverThumbnail = uploaded.thumbnail;
              }
            } catch (uploadErr: any) {
              clearInterval(progressInterval);
              console.warn(`Server upload notice for ${item.name}, using resilient direct fallback:`, uploadErr);
              const fallback = await createClientFallbackFileInfo(item.file);
              fileUrl = fallback.url || '';
              serverThumbnail = fallback.thumbnail || (isImageFile(item.file) ? fallback.url : '');
            }
          }

          // Safety guard: Ensure properties never exceed Firestore limits (1,048,487 bytes)
          const safeUrl = (fileUrl && fileUrl.length < 700000) ? fileUrl : '';
          const safeData = (serverThumbnail && serverThumbnail.length < 700000) ? serverThumbnail : '';

          if (!safeUrl || !safeUrl.trim()) {
            console.error(`Không thể gửi tệp "${item.name}" do lỗi kết nối lưu trữ.`);
            setStatusMessage(pick(
              'Không thể gửi tệp "{name}" do không thể kết nối lưu trữ lên máy chủ. Vui lòng thử lại.',
              'Unable to send "{name}" due to storage upload failure. Please try again.',
              '由于存储上传失败，无法发送 “{name}”，请重试。'
            ).replace('{name}', item.name));
            continue;
          }

          const payload: any = {
            senderId: currentUser.uid,
            senderName: userProfile?.displayName || currentUser.displayName || pick('Người dùng', 'User', '用户'),
            senderDevice: settings.deviceName,
            receiverId: target.uid,
            receiverName: target.displayName || target.deviceName,
            status: 'pending',
            createdAt: new Date().toISOString(),
            fileName: item.name,
            fileSize: item.size,
            fileType: item.type || (isImageFile(item) ? 'image/jpeg' : 'application/octet-stream'),
            fileUrl: safeUrl,
            fileData: safeData,
            isTeraBox: item.isTeraBox || false,
            isUrlLink: item.isUrlLink || false
          };

          await addDoc(collection(db, 'transfers'), payload);
        }

        setUploadProgress(100);
        setUploadProgressText(pick(
          'Hoàn tất gửi {total} tệp!',
          'Completed sending {total} file(s)!',
          '已完成发送 {total} 个文件！'
        ).replace('{total}', String(totalFiles)));
      }

      if (hasText) {
        const payload: any = {
          senderId: currentUser.uid,
          senderName: userProfile?.displayName || currentUser.displayName || pick('Người dùng', 'User', '用户'),
          senderDevice: settings.deviceName,
          receiverId: target.uid,
          receiverName: target.displayName || target.deviceName,
          status: 'pending',
          createdAt: new Date().toISOString(),
          textContent: censorProfanity(textContent.trim()).cleanText
        };
        await addDoc(collection(db, 'transfers'), payload);
      }

      if (settings.soundEnabled) {
        playSendSound();
      }

      setTransferStatus(prev => ({ ...prev, [target.uid]: 'success' }));
      const msgDesc = hasFiles && hasText
        ? pick(
            'Đã chuyển thành công {count} tệp & tin nhắn đến {device}!',
            'Transferred {count} file(s) & message to {device} successfully!',
            '已成功向 {device} 传输 {count} 个文件及消息！'
          ).replace('{count}', String(targetFiles.length)).replace('{device}', target.deviceName)
        : hasFiles
        ? pick(
            'Đã chuyển thành công {count} tệp đến {device}!',
            'Transferred {count} file(s) to {device} successfully!',
            '已成功向 {device} 传输 {count} 个文件！'
          ).replace('{count}', String(targetFiles.length)).replace('{device}', target.deviceName)
        : pick(
            'Đã gửi tin nhắn thành công đến {device}!',
            'Message sent to {device} successfully!',
            '已成功向 {device} 发送消息！'
          ).replace('{device}', target.deviceName);
      setStatusMessage(msgDesc);

      // Clear/Reset selection when sent successfully
      setSelectedFiles([]);
      setTextContent('');
      setFileThumbnails({});
      setUploadProgress(null);
      setUploadProgressText(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';

      setTimeout(() => {
        setTransferStatus(prev => ({ ...prev, [target.uid]: 'idle' }));
        setSendingTargetId(null);
      }, 3000);
    } catch (error: any) {
      console.error('Send error:', error);
      setTransferStatus(prev => ({ ...prev, [target.uid]: 'error' }));
      setStatusMessage(error?.message || pick(
        'Lỗi khi tải hoặc gửi dữ liệu. Vui lòng thử lại.',
        'Error uploading or sending data. Please try again.',
        '上传或发送数据时出错，请重试。'
      ));
      setSendingTargetId(null);
    }
  };

  const handleDeleteSentItem = async (transferId: string) => {
    try {
      await deleteDoc(doc(db, 'transfers', transferId));
    } catch (e) {
      console.warn('Failed to delete sent transfer record:', e);
    }
  };

  // Manual Re-scan & Cache Purge:
  // Immediately emits fresh heartbeat, bypasses cache to fetch fresh records directly from server,
  // cleans up dead/stale offline devices, and updates the online list!
  const handleRescan = async () => {
    if (!currentUser || isRescanning) return;
    setIsRescanning(true);

    try {
      // 1. Immediately emit heartbeat for our device
      if (updatePresence) {
        await updatePresence(currentUser.uid);
      }

      // 2. Fetch fresh presence records directly from Firestore Server (bypass client cache)
      const presenceRef = collection(db, 'presence');
      let snap;
      try {
        snap = await getDocsFromServer(presenceRef);
      } catch {
        snap = await getDocs(presenceRef);
      }

      latestPresenceDocsRef.current = snap.docs;
      const currentDevId = getClientDeviceId();
      const { liveDevices, toPurgeDocIds } = processPresenceDocs(snap.docs, currentDevId, currentUser.uid);

      // Await purging of dead records from server
      if (toPurgeDocIds.length > 0) {
        await Promise.all(
          toPurgeDocIds.map((id) => deleteDoc(doc(db, 'presence', id)).catch(() => {}))
        );
      }

      setOnlineDevices(liveDevices);
      setStatusMessage(
        liveDevices.length > 0
          ? toPurgeDocIds.length > 0
            ? pick(
                'Đã cập nhật: Phát hiện {count} thiết bị đang trực tuyến (đã dọn {cleaned} thiết bị cũ).',
                'Updated: Detected {count} device(s) online (cleaned {cleaned} offline devices).',
                '已更新：检测到 {count} 台设备在线（已清理 {cleaned} 台离线设备）。'
              ).replace('{count}', String(liveDevices.length)).replace('{cleaned}', String(toPurgeDocIds.length))
            : pick(
                'Đã cập nhật: Phát hiện {count} thiết bị đang trực tuyến.',
                'Updated: Detected {count} device(s) online.',
                '已更新：检测到 {count} 台设备在线。'
              ).replace('{count}', String(liveDevices.length))
          : toPurgeDocIds.length > 0
            ? pick(
                'Đã cập nhật: Hiện không có thiết bị nào khác trực tuyến (đã dọn dẹp {cleaned} thiết bị cũ đã tắt).',
                'Updated: No other devices currently online (cleaned {cleaned} offline devices).',
                '已更新：当前没有其他在线设备（已清理 {cleaned} 台离线设备）。'
              ).replace('{cleaned}', String(toPurgeDocIds.length))
            : pick(
                'Đã cập nhật: Hiện không có thiết bị nào khác trực tuyến.',
                'Updated: No other devices currently online.',
                '已更新：当前没有其他在线设备。'
              )
      );
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      console.warn('Rescan error:', err);
    } finally {
      setTimeout(() => setIsRescanning(false), 500);
    }
  };

  const renderDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'mobile': return <Smartphone className="w-5 h-5" />;
      case 'tablet': return <Tablet className="w-5 h-5" />;
      case 'desktop': return <Monitor className="w-5 h-5" />;
      case 'tv': return <Tv className="w-5 h-5 text-emerald-400" />;
      default: return <Laptop className="w-5 h-5" />;
    }
  };

  const myDeviceId = getClientDeviceId();
  const myConnectCode = myDeviceId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();

  const [isSearchingCode, setIsSearchingCode] = useState(false);

  const CLSEND_DEMO_DEVICE: PresenceDevice = {
    deviceId: 'official_clsend_relay_node',
    uid: 'u_clsend_official',
    connectCode: 'CLSEND',
    displayName: 'CloudSend Official Hub',
    deviceName: 'CloudSend Relay Node',
    deviceType: 'desktop',
    avatarColor: '#10B981',
    status: 'online',
    lastSeen: new Date().toISOString(),
    lastSeenMs: Date.now(),
  };

  // Directly connect to any peer across internet by their 6-digit Connect Code
  const handleDirectCodeConnect = async (codeToSearch?: string) => {
    const rawCode = (codeToSearch || searchQuery).trim().toUpperCase().replace('#', '');
    if (!rawCode || isSearchingCode) return;

    // Check if searching for CLSend / clsend / Clsend or related
    if (rawCode.includes('CLSEND') || rawCode.includes('CLS') || rawCode === 'CL' || rawCode.includes('CLSEND') || rawCode.includes('CLSEND')) {
      setOnlineDevices((prev) => {
        if (prev.some(d => d.connectCode === 'CLSEND')) return prev;
        return [CLSEND_DEMO_DEVICE, ...prev];
      });
      setStatusMessage(pick(
        'Đã kết nối thành công với "CloudSend Official Relay" (Mã #CLSEND)! Nhấn nút "Gửi đến thiết bị này" bên dưới để chuyển tệp.',
        'Connected successfully to "CloudSend Official Relay" (Code #CLSEND)! Click "Send to this device" below to transfer.',
        '已成功连接 “CloudSend Official Relay”（代码 #CLSEND）！点击下方“发送到此设备”即可传输。'
      ));
      setTimeout(() => setStatusMessage(null), 6000);
      setIsSearchingCode(false);
      return;
    }

    setIsSearchingCode(true);

    try {
      const q = query(collection(db, 'presence'), where('connectCode', '==', rawCode));
      let snap;
      try {
        snap = await getDocsFromServer(q);
      } catch {
        snap = await getDocs(q);
      }

      if (snap.empty) {
        setStatusMessage(pick(
          'Không tìm thấy thiết bị nào với mã #{code}. Vui lòng kiểm tra lại mã trên máy người nhận.',
          "No device found with code #{code}. Please check code on receiver's screen.",
          '未找到代码为 #{code} 的设备，请核对接收方屏幕上的代码。'
        ).replace('{code}', rawCode));
        setTimeout(() => setStatusMessage(null), 5000);
      } else {
        const foundDoc = snap.docs[0];
        const data = { id: foundDoc.id, ...foundDoc.data({ serverTimestamps: 'estimate' }) } as unknown as PresenceDevice;
        if (data.deviceId === getClientDeviceId()) {
          setStatusMessage(pick(
            'Đây là mã ghép của chính thiết bị hiện tại của bạn!',
            'This is the pair code of your own current device!',
            '这是您当前设备自身的配对代码！'
          ));
          setTimeout(() => setStatusMessage(null), 4000);
        } else {
          setOnlineDevices((prev) => {
            if (prev.some(d => d.uid === data.uid || (d.deviceId && d.deviceId === data.deviceId))) {
              return prev;
            }
            return [data, ...prev];
          });
          setStatusMessage(pick(
            'Đã kết nối thành công với "{device}" ({name})! Nhấn nút "Gửi đến thiết bị này" bên dưới để chuyển tệp.',
            'Connected successfully to "{device}" ({name})! Click "Send to this device" below to transfer.',
            '已成功连接到 “{device}” ({name})！点击下方“发送到此设备”即可传输。'
          ).replace('{device}', data.deviceName).replace('{name}', data.displayName));
          setTimeout(() => setStatusMessage(null), 6000);
        }
      }
    } catch (e) {
      console.warn('Direct code connect error:', e);
    } finally {
      setIsSearchingCode(false);
    }
  };

  const filteredDevices = (() => {
    const q = searchQuery.toLowerCase().trim();
    const baseFiltered = onlineDevices.filter(d => 
      d.deviceName.toLowerCase().includes(q) ||
      d.displayName.toLowerCase().includes(q) ||
      (d.connectCode && d.connectCode.toLowerCase().includes(q))
    );

    const wantsClsend = q.includes('clsend') || q.includes('cl') || q.includes('cloudsend');
    if (wantsClsend && !baseFiltered.some(d => d.connectCode === 'CLSEND')) {
      return [CLSEND_DEMO_DEVICE, ...baseFiltered];
    }
    return baseFiltered;
  })();

  return (
    <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
      {/* Your Device Online Status Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md ring-2 ring-emerald-500/20 overflow-hidden relative"
            style={{ backgroundColor: settings.avatarColor || '#10B981' }}
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
              renderDeviceIcon(settings.deviceType)
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-bold text-white truncate">
                {settings.deviceName}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {t('send.device_online')}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300 bg-slate-950 px-2 py-0.5 rounded-lg border border-emerald-500/30" title={pick('Mã ghép nhanh 6 số của thiết bị này để máy khác kết nối ngay', '6-digit quick pairing code for this device so others can connect right away', '此设备的 6 位快速配对码，方便其他设备立即连接')}>
                <span className="text-slate-400 font-sans">{t('send.pair_code_label')}</span>
                <strong>{myConnectCode}</strong>
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {pick(
                'Đang phát sóng trên Cloud Relay • Người khác có thể tìm thấy tên hoặc nhập mã {code} để gửi tệp',
                'Broadcasting on Cloud Relay • Others can find your name or enter code {code} to send files',
                '正在 Cloud Relay 上广播 • 其他人可搜索您的名称或输入代码 {code} 向您发送文件'
              ).replace('{code}', myConnectCode)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 self-end sm:self-auto bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
          <span>{t('send.account_label')}</span>
          <span className="font-semibold text-white">{currentUser?.displayName || currentUser?.email?.split('@')[0]}</span>
        </div>
      </div>

      {/* Top Bar / Content Selector (Compact & Sleek) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                {t('send.content_title')}
              </h2>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {t('send.content_sub')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCloudPickerOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
          >
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span>{t('nav.drive')}</span>
          </button>
        </div>

        {/* Unified Content Dropzone / Queue */}
        <div>
          {/* General file input - multiple allowed for any file types */}
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files) handleFilesAdded(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
          {/* Dedicated image & video picker input - multiple allowed */}
          <input
            type="file"
            multiple
            accept="image/*,video/*,.heic,.heif,.dng,.raw"
            ref={imageInputRef}
            onChange={(e) => {
              if (e.target.files) handleFilesAdded(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
          {/* Folder input for full directories */}
          <input
            type="file"
            multiple
            ref={folderInputRef}
            {...({ webkitdirectory: "", directory: "" } as any)}
            onChange={(e) => {
              if (e.target.files) handleFilesAdded(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
          {/* Direct Camera input for mobile phones */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            onChange={(e) => {
              if (e.target.files) handleFilesAdded(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
          
          <div
            id="file-dropzone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => selectedFiles.length === 0 && !textContent.trim() && fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl p-3 sm:p-3.5 transition-all ${
              isDragOver
                ? 'border-emerald-400 bg-emerald-500/10 scale-[1.005]'
                : (selectedFiles.length > 0 || textContent.trim().length > 0)
                ? 'border-emerald-500/50 bg-emerald-500/5 cursor-default'
                : 'border-slate-700/70 hover:border-emerald-500/40 bg-slate-950/40 hover:bg-slate-950/60 cursor-pointer'
            }`}
          >
            {(selectedFiles.length > 0 || textContent.trim().length > 0) ? (
              <div className="space-y-2.5">
                {/* Header info bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Files className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left">
                      <span className="text-xs sm:text-sm font-bold text-white block">
                        {pick('Đã chọn ', 'Selected ', '已选择 ')}
                        {selectedFiles.length > 0 ? `${selectedFiles.length} ${pick('tệp tin', 'file(s)', '个文件')}` : ''}
                        {selectedFiles.length > 0 && textContent.trim() ? ' & ' : ''}
                        {textContent.trim() ? pick('1 tin nhắn văn bản', '1 text message', '1 条文本消息') : ''}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {selectedFiles.length > 0 && `${pick('Tổng', 'Total', '总计')}: ${formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))} • `}{pick('Sẵn sàng gửi', 'Ready to send', '准备发送')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenTextModal(textContent);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
                    >
                      <AlignLeft className="w-3 h-3 text-emerald-400" />
                      <span>{textContent.trim() ? pick('Sửa văn bản', 'Edit text', '编辑文本') : pick('Thêm văn bản', 'Add text', '添加文本')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
                    >
                      <Plus className="w-3 h-3 text-emerald-400" />
                      <span>{pick('Thêm tệp', 'Add file', '添加文件')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearAllFiles();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                      <span>{pick('Xóa hết', 'Clear all', '全部清除')}</span>
                    </button>
                  </div>
                </div>

                {/* Text Message Card if text is entered */}
                {textContent.trim().length > 0 && (
                  <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-left hover:border-slate-700 transition-all space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                          <AlignLeft className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block">{pick('Tin nhắn văn bản', 'Text message', '文本消息')}</span>
                          <span className="text-[10px] text-slate-400 block">
                            {textContent.split(/\s+/).filter(Boolean).length} {pick('từ', 'words', '词')} • {textContent.length} {pick('ký tự', 'chars', '字符')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title={pick('Chỉnh sửa tin nhắn này', 'Edit this message', '编辑此消息')}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTextModal(textContent);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Edit3 className="w-3 h-3 text-sky-400" />
                          <span>{pick('Sửa', 'Edit', '编辑')}</span>
                        </button>
                        <button
                          type="button"
                          title={pick('Xóa tin nhắn này', 'Delete this message', '删除此消息')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTextContent('');
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-24 overflow-y-auto scrollbar-thin font-mono leading-relaxed">
                      {textContent}
                    </div>

                    {/* Detected links preview */}
                    {extractUrls(textContent).length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Link:
                        </span>
                        {extractUrls(textContent).map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200 underline font-semibold max-w-[200px] truncate"
                          >
                            <span>{url}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Files List / Cards */}
                {selectedFiles.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {selectedFiles.map((file, idx) => {
                      const isImg = isImageFile(file);
                      const isVid = isVideoFile(file);
                      const thumb = fileThumbnails[file.name];

                      return (
                        <div
                          key={`${file.name}_${file.size}_${idx}`}
                          className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-left hover:border-slate-700 transition-all"
                        >
                          <div
                            onClick={(e) => {
                              if (!isImg && !isVid) return;
                              e.stopPropagation();
                              if (isImg) {
                                const imgTarget = thumb || file.viewUrl || file.cloudUrl || '';
                                if (imgTarget) setViewingImage(imgTarget);
                              } else if (isVid) {
                                setViewingVideo(file);
                              }
                            }}
                            className={`flex items-center gap-2.5 min-w-0 flex-1 ${
                              (isImg && (thumb || file.viewUrl || file.cloudUrl)) || isVid ? 'cursor-pointer' : ''
                            }`}
                          >
                            {isImg ? (
                              <div
                                className="relative group w-10 h-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shrink-0"
                              >
                                {thumb ? (
                                  <img src={thumb} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-emerald-400">
                                    <ImageIcon className="w-4 h-4" />
                                  </div>
                                )}
                                {thumb && (
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Eye className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </div>
                            ) : isVid ? (
                              <div
                                className="relative group w-10 h-10 rounded-lg overflow-hidden border border-emerald-500/50 bg-black shrink-0 shadow-xs flex items-center justify-center active:scale-95 transition-transform"
                                title={pick('Bấm để xem video', 'Click to preview video', '点击预览视频')}
                              >
                                {thumb ? (
                                  <img src={thumb} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-950 text-emerald-400">
                                    <Film className="w-5 h-5" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-emerald-950/60 flex items-center justify-center transition-all">
                                  <div className="w-5 h-5 rounded-full bg-emerald-500/90 text-slate-950 flex items-center justify-center shadow-md">
                                    <Play className="w-2.5 h-2.5 fill-slate-950 ml-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <FileDocIcon fileName={file.name} mimeType={file.type} size="sm" />
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-white block truncate max-w-[180px] sm:max-w-md">
                                  {file.name}
                                </span>
                                {file.isTeraBox ? (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold inline-flex items-center gap-1 shrink-0">
                                    <HardDrive className="w-2.5 h-2.5 text-blue-400" /> TeraBox 1TB
                                  </span>
                                ) : file.isFromCloud ? (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold inline-flex items-center gap-0.5 shrink-0">
                                    <Cloud className="w-2.5 h-2.5" /> Cloud
                                  </span>
                                ) : file.isUrlLink ? (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold inline-flex items-center gap-0.5 shrink-0">
                                    <LinkIcon className="w-2.5 h-2.5" /> Link
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-[10px] text-slate-400 block">
                                {file.isTeraBox ? pick('Liên kết tệp đám mây TeraBox', 'TeraBox Cloud File Link', 'TeraBox 云盘文件链接') : file.isUrlLink ? pick('Liên kết trực tiếp', 'Direct Link', '直链') : `${formatFileSize(file.size)} • ${getDocumentTypeInfo(file.name, file.type, currentLang).label}`}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            title={pick('Xóa tệp này', 'Remove this file', '移除此文件')}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(idx);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-[11px] text-emerald-400 font-medium text-center pt-0.5">
                  ✓ {pick('Chọn thiết bị ở danh sách bên dưới để truyền ngay', 'Select a device from the list below to send now', '从下方列表选择设备即可立即发送')}
                </p>
              </div>
            ) : (
              /* Compact Sleek Action Grid (4 Buttons) */
              <div className="py-1 sm:py-1.5 space-y-2.5 text-left">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                  {/* 1. Tập tin */}
                  <button
                    id="pick-file-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="p-2.5 sm:p-3 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/70 hover:border-emerald-500/50 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer will-change-transform transform-gpu select-none transition-transform duration-75 ease-out active:scale-95 active:opacity-90 shadow-sm group focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
                    style={{ transform: 'translateZ(0)', contain: 'layout paint' }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-700/50 group-hover:bg-emerald-500/20 flex items-center justify-center text-slate-200 group-hover:text-emerald-400 transition-colors duration-150 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white block leading-tight">
                        {t('send.file')}
                      </span>
                      <span className="text-[10px] text-slate-400 hidden sm:block">{t('send.file_sub')}</span>
                    </div>
                  </button>

                  {/* 2. Thư mục */}
                  <button
                    id="pick-folder-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      folderInputRef.current?.click();
                    }}
                    className="p-2.5 sm:p-3 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/70 hover:border-amber-500/50 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer will-change-transform transform-gpu select-none transition-transform duration-75 ease-out active:scale-95 active:opacity-90 shadow-sm group focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                    style={{ transform: 'translateZ(0)', contain: 'layout paint' }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-700/50 group-hover:bg-amber-500/20 flex items-center justify-center text-slate-200 group-hover:text-amber-400 transition-colors duration-150 shrink-0">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white block leading-tight">
                        {t('send.folder')}
                      </span>
                      <span className="text-[10px] text-slate-400 hidden sm:block">{t('send.folder_sub')}</span>
                    </div>
                  </button>

                  {/* 3. Văn bản -> opens Text Modal (INP optimized < 20ms) */}
                  <button
                    id="pick-text-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startTransition(() => {
                        handleOpenTextModal();
                      });
                    }}
                    className="p-2.5 sm:p-3 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/70 hover:border-sky-500/50 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer will-change-transform transform-gpu select-none transition-transform duration-75 ease-out active:scale-95 active:opacity-90 shadow-sm group focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
                    style={{ transform: 'translateZ(0)', contain: 'layout paint' }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-700/50 group-hover:bg-sky-500/20 flex items-center justify-center text-slate-200 group-hover:text-sky-400 transition-colors duration-150 shrink-0">
                      <AlignLeft className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white block leading-tight">
                        {t('send.text')}
                      </span>
                      <span className="text-[10px] text-slate-400 hidden sm:block">{t('send.text_sub')}</span>
                    </div>
                  </button>

                  {/* 4. Dán */}
                  <button
                    id="pick-paste-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startTransition(() => {
                        handlePasteAction();
                      });
                    }}
                    className="p-2.5 sm:p-3 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/70 hover:border-teal-500/50 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer will-change-transform transform-gpu select-none transition-transform duration-75 ease-out active:scale-95 active:opacity-90 shadow-sm group focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none"
                    style={{ transform: 'translateZ(0)', contain: 'layout paint' }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-700/50 group-hover:bg-teal-500/20 flex items-center justify-center text-slate-200 group-hover:text-teal-400 transition-colors duration-150 shrink-0">
                      <Clipboard className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white block leading-tight">
                        {t('send.paste')}
                      </span>
                      <span className="text-[10px] text-slate-400 hidden sm:block">{t('send.paste_sub')}</span>
                    </div>
                  </button>
                </div>

                {/* Dropzone subtle helper */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>{t('send.drop_hint')}</span>
                  <span className="hidden sm:inline">{t('send.size_hint')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Upload Progress Bar */}
          {uploadProgress !== null && (
            <div className="mt-3 p-3 bg-slate-900/90 border border-emerald-500/40 rounded-xl space-y-1.5 shadow-lg animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5 truncate">
                  <UploadCloud className="w-3.5 h-3.5 animate-bounce shrink-0" />
                  <span>{uploadProgressText || pick('Đang tải tệp lên máy chủ...', 'Uploading file to server...', '正在上传文件到服务器...')}</span>
                </span>
                <span className="text-white font-mono font-bold shrink-0">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status notice */}
        {statusMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Target Devices (Nearby / Online on Internet Relay) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-teal-400 shrink-0" />
                <span>{t('send.nearby_title')}</span>
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono whitespace-nowrap shrink-0">
                {onlineDevices.length} {t('nav.devices', 'thiết bị')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('send.nearby_sub')}
            </p>
          </div>

          {/* Search bar & Refresh */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRescan}
              disabled={isRescanning}
              title={t('send.rescan')}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRescanning ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">{isRescanning ? t('send.rescanning') : t('send.rescan')}</span>
            </button>
            <div className="relative flex-1 sm:w-72 flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim().length >= 4) {
                      e.preventDefault();
                      handleDirectCodeConnect();
                    }
                  }}
                  placeholder={t('send.search_placeholder')}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              {searchQuery.trim().length >= 4 && (
                <button
                  type="button"
                  onClick={() => handleDirectCodeConnect()}
                  disabled={isSearchingCode}
                  title={pick('Tìm và kết nối trực tiếp đến mã này trên Cloud', 'Find and connect directly to this code on Cloud', '在云端查找并直接连接到此代码')}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSearchingCode ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Radio className="w-3 h-3" />
                  )}
                  <span>{t('send.pair_code')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Devices Grid (LocalSend style) */}
        {filteredDevices.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 sm:p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/60 text-slate-400 mx-auto flex items-center justify-center animate-pulse">
              <Radio className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">{t('send.scanning_title')}</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {t('send.scanning_sub')}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDevices.map((device) => {
              const status = transferStatus[device.uid] || 'idle';
              const isSendingToThis = sendingTargetId === device.uid;

              return (
                <div
                  key={device.uid}
                  id={`peer-card-${device.uid}`}
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Device Icon Avatar */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform overflow-hidden relative"
                      style={{ backgroundColor: device.avatarColor || '#10B981' }}
                    >
                      {device.customAvatarUrl ? (
                        <img 
                          src={device.customAvatarUrl} 
                          alt={device.displayName || 'Device'} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        renderDeviceIcon(device.deviceType)
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-white truncate">
                          {device.deviceName}
                        </h4>
                        {device.connectCode && (
                          <span className="text-[10px] font-mono text-emerald-300 bg-slate-950 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            #{device.connectCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {device.displayName}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {pick('Mạng Cục Bộ (LAN) & Relay', 'LAN & Cloud Relay', '局域网 (LAN) 与中继')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Send Action Button */}
                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-end">
                    <button
                      id={`send-to-${device.uid}`}
                      type="button"
                      disabled={isSendingToThis}
                      onClick={() => handleDeviceClick(device)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 will-change-transform transform-gpu select-none transition-transform duration-75 ease-out ${
                        status === 'success'
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : status === 'error'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm active:scale-[0.98]'
                      }`}
                      style={{ transform: 'translateZ(0)', contain: 'layout paint' }}
                    >
                      {status === 'sending' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{t('send.sending_server')}</span>
                        </>
                      ) : status === 'success' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('send.sent_success')}</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>{t('send.send_to_device')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sent History (Lịch sử các tệp và ảnh bạn đã gửi đi) */}
      {sentTransfers.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-800/60">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              {pick('Lịch sử tệp bạn đã gửi ({count})', 'Sent files history ({count})', '已发送文件记录 ({count})').replace('{count}', String(sentTransfers.length))}
            </h3>
            <span className="text-[11px] text-slate-400">{pick('Ảnh và tệp gần đây', 'Recent photos and files', '最近的照片和文件')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sentTransfers.map((item) => {
              const isImage = item.fileType?.startsWith('image/') && !!item.fileData;

              return (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail for sent image */}
                    {isImage ? (
                      <div 
                        onClick={() => setViewingImage(item.fileData)}
                        className="relative group cursor-pointer w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shrink-0"
                        title={pick('Bấm để xem ảnh lớn', 'Click to view full image', '点击查看大图')}
                      >
                        <img src={item.fileData} alt={item.fileName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                        {item.fileName ? <FileText className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-teal-400" />}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white block truncate">
                        {item.fileName ? (
                          <span>{item.fileName}</span>
                        ) : item.textContent ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-400 font-normal">{pick('Gửi:', 'Sent:', '发送：')}</span>
                            {renderClickableText(item.textContent, true, 'text-emerald-300 underline font-semibold hover:text-white inline-flex items-center gap-1')}
                          </div>
                        ) : (
                          pick('Tệp tin', 'File', '文件')
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {pick('Tới:', 'To:', '发送给：')} <strong className="text-slate-300">{item.receiverName}</strong> • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'completed' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {pick('Đã nhận', 'Received', '已接收')}
                      </span>
                    )}
                    {item.status === 'pending' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                        {pick('Đang chờ', 'Pending', '等待中')}
                      </span>
                    )}
                    {item.status === 'declined' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20 font-semibold">
                        {pick('Từ chối', 'Declined', '已拒绝')}
                      </span>
                    )}

                    <button
                      type="button"
                      title={pick('Xóa bản ghi này', 'Delete this record', '删除此记录')}
                      onClick={() => handleDeleteSentItem(item.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cloud Drive Picker Modal */}
      <CloudDrivePickerModal
        isOpen={isCloudPickerOpen}
        onClose={() => setIsCloudPickerOpen(false)}
        onSelectFiles={handleCloudFilesAdded}
        alreadySelectedUrls={selectedFiles.filter(f => f.cloudUrl).map(f => f.cloudUrl!)}
      />

      {/* Image Preview Modal */}
      {viewingImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/80 text-white hover:bg-slate-800 z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={viewingImage} alt={pick('Xem trước', 'Preview', '预览')} className="max-w-full max-h-[80vh] rounded-xl object-contain mx-auto shadow-2xl" />
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {viewingVideo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setViewingVideo(null)}
        >
          <div 
            className="relative max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-3 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Film className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md" title={viewingVideo.name}>
                    {viewingVideo.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {formatFileSize(viewingVideo.size)} • {pick('Xem thử video trước khi gửi', 'Previewing before send', '发送前预览视频')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingVideo(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={pick('Đóng', 'Close', '关闭')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player */}
            <div className="p-2 sm:p-4 bg-black flex items-center justify-center">
              <VideoPreviewPlayer
                file={viewingVideo.file}
                src={viewingVideo.viewUrl || viewingVideo.cloudUrl}
                fallbackUrl={viewingVideo.cloudUrl}
                fileName={viewingVideo.name}
                fileSize={viewingVideo.size}
                autoPlay={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Quick Choice Modal when clicking an online device without pre-selected content */}
      {showQuickChoiceModal && targetDeviceForQuickChoice && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-[2px] animate-in fade-in duration-150 touch-none overscroll-none"
          onClick={() => {
            setShowQuickChoiceModal(false);
            setTargetDeviceForQuickChoice(null);
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-5 w-full max-w-sm shadow-2xl space-y-4 text-left animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    {pick('Gửi tới {name}', 'Send to {name}', '发送到 {name}').replace('{name}', targetDeviceForQuickChoice.deviceName)}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {pick('Chọn loại nội dung muốn gửi:', 'Select content type to send:', '选择要发送的内容类型：')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowQuickChoiceModal(false);
                  setTargetDeviceForQuickChoice(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4 Compact Cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {/* 1. Tập tin */}
              <button
                type="button"
                onClick={() => {
                  setShowQuickChoiceModal(false);
                  fileInputRef.current?.click();
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 hover:border-emerald-500/50 flex flex-col items-center justify-center gap-1.5 text-center transition-all active:scale-95 group shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-700/50 group-hover:bg-emerald-500/20 flex items-center justify-center text-slate-200 group-hover:text-emerald-400 transition-colors">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  {pick('Tập tin', 'File', '文件')}
                </span>
              </button>

              {/* 2. Thư mục */}
              <button
                type="button"
                onClick={() => {
                  setShowQuickChoiceModal(false);
                  folderInputRef.current?.click();
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 hover:border-amber-500/50 flex flex-col items-center justify-center gap-1.5 text-center transition-all active:scale-95 group shadow-sm focus-visible:ring-2 focus-visible:ring-amber-400 focus:outline-none"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-700/50 group-hover:bg-amber-500/20 flex items-center justify-center text-slate-200 group-hover:text-amber-400 transition-colors">
                  <Folder className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  {pick('Thư mục', 'Folder', '文件夹')}
                </span>
              </button>

              {/* 3. Văn bản */}
              <button
                type="button"
                onClick={() => {
                  const target = targetDeviceForQuickChoice;
                  setShowQuickChoiceModal(false);
                  handleOpenTextModal('', target || undefined);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 hover:border-sky-500/50 flex flex-col items-center justify-center gap-1.5 text-center transition-all active:scale-95 group shadow-sm focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-700/50 group-hover:bg-sky-500/20 flex items-center justify-center text-slate-200 group-hover:text-sky-400 transition-colors">
                  <AlignLeft className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  {pick('Văn bản', 'Text', '文本')}
                </span>
              </button>

              {/* 4. Dán */}
              <button
                type="button"
                onClick={() => {
                  setShowQuickChoiceModal(false);
                  handlePasteAction();
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 hover:border-teal-500/50 flex flex-col items-center justify-center gap-1.5 text-center transition-all active:scale-95 group shadow-sm focus-visible:ring-2 focus-visible:ring-teal-400 focus:outline-none"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-700/50 group-hover:bg-teal-500/20 flex items-center justify-center text-slate-200 group-hover:text-teal-400 transition-colors">
                  <Clipboard className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  {pick('Dán', 'Paste', '粘贴')}
                </span>
              </button>
              
            </div>
            <div className="pt-1.5 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowQuickChoiceModal(false);
                  setIsCloudPickerOpen(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Cloud className="w-3.5 h-3.5 text-sky-400" />
                <span>{pick('Chọn từ Kho Cloud Drive', 'Select from Cloud Drive', '从云盘选择')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TeraBox & Cloud Link Input Modal */}
      {isUrlModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-[2px] animate-in fade-in duration-150 touch-none overscroll-none"
          onClick={() => setIsUrlModalOpen(false)}
        >
          <div 
            className="bg-[#181e29] border border-slate-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-sm sm:max-w-md shadow-2xl space-y-3.5 text-left animate-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                    {pick('Thêm tệp TeraBox / Cloud', 'Add TeraBox / Cloud File', '添加 TeraBox / 云端文件')}
                  </h3>
                  <span className="text-[10px] text-blue-300 font-medium">{pick('Hỗ trợ kho miễn phí 1024 GB (1TB)', 'Supports 1024 GB (1TB) free storage', '支持 1024 GB (1TB) 免费存储')}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {pick(
                'Dán đường dẫn chia sẻ từ TeraBox (hoặc Google Drive, Fshare, OneDrive) để gửi tệp siêu lớn mà không tốn dung lượng upload:',
                'Paste a share link from TeraBox (or Google Drive, Fshare, OneDrive) to send huge files without using upload quota:',
                '粘贴来自 TeraBox（或 Google Drive、Fshare、OneDrive）的分享链接，无需占用上传额度即可发送超大文件：'
              )}
            </p>

            {/* Input URL */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">
                {pick('1. Đường dẫn liên kết (URL):', '1. Link URL:', '1. 链接地址 (URL)：')}
              </label>
              <div className="rounded-xl overflow-hidden bg-[#242b3b] border border-slate-700/70 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all p-2.5">
                <input
                  type="url"
                  value={urlModalValue}
                  onChange={(e) => setUrlModalValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleUrlAdded();
                    }
                  }}
                  placeholder={pick('https://terabox.com/s/1... hoặc https://1024tera.com/s/...', 'https://terabox.com/s/1... or https://1024tera.com/s/...', 'https://terabox.com/s/1... 或 https://1024tera.com/s/...')}
                  className="w-full bg-transparent text-white text-xs sm:text-sm focus:outline-none placeholder:text-slate-500 font-mono"
                  autoFocus
                />
              </div>
            </div>

            {/* Input Custom Title */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">
                {pick('2. Tên tệp hiển thị (Tùy chọn):', '2. Display File Name (Optional):', '2. 显示文件名（可选）：')}
              </label>
              <div className="rounded-xl overflow-hidden bg-[#242b3b] border border-slate-700/70 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all p-2.5">
                <input
                  type="text"
                  value={urlCustomName}
                  onChange={(e) => setUrlCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleUrlAdded();
                    }
                  }}
                  placeholder={pick('Ví dụ: Video_Ky_Yeu_4K.zip, Tai_Lieu_Hoc_Tap.pdf', 'Example: Video_4K.zip, Study_Notes.pdf', '例如：Video_4K.zip, Document.pdf')}
                  className="w-full bg-transparent text-white text-xs sm:text-sm focus:outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Helper link to terabox.com */}
            <div className="pt-1 flex items-center justify-between text-[11px]">
              <a
                href="https://www.terabox.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1 font-medium"
              >
                <span>{pick('Chưa có link? Mở TeraBox để lấy link (1TB)', 'No link yet? Open TeraBox to get link (1TB)', '还没有链接？打开 TeraBox 获取链接 (1TB)')}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-slate-800"
              >
                {pick('Thoát', 'Exit', '退出')}
              </button>
              <button
                type="button"
                onClick={() => handleUrlAdded()}
                disabled={!urlModalValue.trim()}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <HardDrive className="w-4 h-4" />
                <span>{pick('Xác nhận thêm tệp', 'Add TeraBox File', '确认添加文件')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Message Input Modal (Compact floating box, background dimmed without lag, body scroll locked) */}
      {isTextModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-[2px] animate-in fade-in duration-150 touch-none overscroll-none"
          onClick={() => {
            setIsTextModalOpen(false);
            setTargetDeviceForQuickChoice(null);
          }}
        >
          <div 
            className="bg-[#181e29] border border-slate-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-sm sm:max-w-md shadow-2xl space-y-3.5 text-left animate-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                <AlignLeft className="w-4 h-4 text-sky-400" />
                <span>{pick('Nhập tin nhắn', 'Enter Message', '输入消息')}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsTextModalOpen(false);
                  setTargetDeviceForQuickChoice(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input area: Compact, focused, smooth typing without lag */}
            <div className="rounded-xl overflow-hidden bg-[#242b3b] border border-slate-700/70 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/20 transition-all">
              <RichChatInput
                id="modal-message-input"
                value={modalTextValue}
                onChange={(md) => setModalTextValue(md)}
                onSend={handleConfirmTextModal}
                enterKeyMode="newline"
                placeholder={pick('Nhập nội dung văn bản cần gửi...', 'Enter message text to send...', '输入要发送的文本内容...')}
                className="bg-transparent border-0 min-h-[100px] max-h-[220px]"
              />
            </div>

            {/* Actions: Thoát & Xác nhận */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsTextModalOpen(false);
                  setTargetDeviceForQuickChoice(null);
                }}
                className="px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-slate-800"
              >
                {pick('Thoát', 'Exit', '退出')}
              </button>
              <button
                type="button"
                onClick={handleConfirmTextModal}
                className="px-5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>{pick('Xác nhận', 'Confirm', '确认')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const SendView = React.memo(SendViewComponent);
