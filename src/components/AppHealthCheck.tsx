import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const AppHealthCheck: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'checking' | 'healthy' | 'warning'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setStatus('checking');
    setErrorMessage(null);
    try {
      // Verify Firestore connection & permissions on boot
      await getDocs(query(collection(db, 'presence'), limit(1)));
      setStatus('healthy');
    } catch (err: any) {
      console.warn('Startup health check notice:', err);
      setStatus('warning');
      setErrorMessage(err?.message || 'Kết nối Firestore đang hoạt động ở chế độ ngoại tuyến hoặc mạng chập chờn.');
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <>
      {status === 'warning' && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span><strong>Kiểm tra hệ thống:</strong> {errorMessage}</span>
          </div>
          <button
            onClick={runDiagnostics}
            className="px-3 py-1 bg-black/30 hover:bg-black/50 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Kiểm tra lại
          </button>
        </div>
      )}
      {children}
    </>
  );
};
