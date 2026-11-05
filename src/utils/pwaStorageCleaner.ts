import { clearCommunitySwarmCache, getCommunityNodeStats, saveCommunityNodeStats } from './p2pCommunitySwarm';
import { clearFileDatabase, getFileStorageStats } from './idbStorage';

export interface StorageEstimateInfo {
  usageMb: number;
  quotaMb: number;
  cacheCount: number;
  idbFilesCount: number;
  idbBytes: number;
}

/**
 * Calculates current client-side storage usage (CacheStorage + IndexedDB + LocalStorage)
 */
export async function getPwaStorageEstimate(): Promise<StorageEstimateInfo> {
  let usageMb = 0;
  let quotaMb = 0;
  let cacheCount = 0;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      usageMb = Math.round(((est.usage || 0) / (1024 * 1024)) * 10) / 10;
      quotaMb = Math.round(((est.quota || 0) / (1024 * 1024)) * 10) / 10;
    } catch {
      // fallback
    }
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      cacheCount = keys.length;
    } catch {}
  }

  const idbStats = await getFileStorageStats().catch(() => ({ count: 0, totalBytes: 0 }));

  return {
    usageMb,
    quotaMb,
    cacheCount,
    idbFilesCount: idbStats.count,
    idbBytes: idbStats.totalBytes,
  };
}

/**
 * Purges all bloated P2P caches, stale file blobs, and temporary dynamic caches.
 * Preserves user credentials, auth sessions, and custom settings.
 */
export async function cleanAllPwaCachesAndBloat(): Promise<{ freedMb: number }> {
  let initialMb = 0;
  try {
    const before = await getPwaStorageEstimate();
    initialMb = before.usageMb;
  } catch {}

  // 1. Purge community P2P cache
  try {
    await clearCommunitySwarmCache();
  } catch (e) {
    console.warn('P2P swarm clear notice:', e);
  }

  // 2. Clear dynamic and obsolete caches from CacheStorage
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheKeys = await window.caches.keys();
      for (const key of cacheKeys) {
        // Keep active workbox precache for offline PWA operation, delete any old or dynamic file caches
        if (
          key.includes('p2p') ||
          key.includes('download') ||
          key.includes('files') ||
          key.includes('blob') ||
          key.includes('cloudsend_community') ||
          key.includes('temp')
        ) {
          await window.caches.delete(key);
        }
      }
    }
  } catch (e) {
    console.warn('Cache purge notice:', e);
  }

  // 3. Clear IndexedDB file store (downloaded and uploaded blob caches)
  try {
    await clearFileDatabase();
  } catch (e) {
    console.warn('IndexedDB clear notice:', e);
  }

  // 4. Reset stats in localStorage
  try {
    const stats = getCommunityNodeStats();
    stats.isActive = false; // ensure disabled by default
    stats.usedCacheBytes = 0;
    stats.sharedFilesCount = 0;
    stats.maxCacheMb = 25;
    saveCommunityNodeStats(stats);
  } catch {}

  let afterMb = 0;
  try {
    const after = await getPwaStorageEstimate();
    afterMb = after.usageMb;
  } catch {}

  const freedMb = Math.max(0, Math.round((initialMb - afterMb) * 10) / 10);
  return { freedMb };
}
