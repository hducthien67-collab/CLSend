/**
 * P2P Community Swarm Cache Node (Inspired by Minecraft Launchers P2P Acceleration)
 * Allows users to share a small slice of local storage/bandwidth to seed & accelerate file downloads for the community.
 */

export interface CommunityNodeStats {
  isActive: boolean;
  maxCacheMb: number;
  usedCacheBytes: number;
  relayedTransfersCount: number;
  sharedFilesCount: number;
  lastActiveTimestamp: number;
}

const STATS_KEY = 'cloudsend_p2p_swarm_stats';
const CACHE_NAME = 'cloudsend_community_p2p_v1';

export function getCommunityNodeStats(): CommunityNodeStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to read community node stats:', err);
  }
  return {
    isActive: true, // Enabled by default to accelerate network
    maxCacheMb: 500, // Default 500 MB shared cache
    usedCacheBytes: 0,
    relayedTransfersCount: 0,
    sharedFilesCount: 0,
    lastActiveTimestamp: Date.now()
  };
}

export function saveCommunityNodeStats(stats: CommunityNodeStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    console.warn('Failed to save community node stats:', err);
  }
}

/**
 * Saves a downloaded file into the local P2P Community Cache
 */
export async function cacheFileInCommunitySwarm(fileId: string, blob: Blob, fileName: string): Promise<void> {
  const stats = getCommunityNodeStats();
  if (!stats.isActive) return;

  const maxBytes = stats.maxCacheMb * 1024 * 1024;
  if (stats.usedCacheBytes + blob.size > maxBytes) {
    // If cache is full, do not exceed user-allocated limit
    return;
  }

  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const url = `/p2p-cache/${encodeURIComponent(fileId)}`;
      const response = new Response(blob, {
        headers: {
          'Content-Type': blob.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(fileName),
          'X-File-Size': String(blob.size),
          'X-Cached-At': String(Date.now())
        }
      });
      await cache.put(url, response);

      stats.usedCacheBytes += blob.size;
      stats.sharedFilesCount += 1;
      stats.lastActiveTimestamp = Date.now();
      saveCommunityNodeStats(stats);
    }
  } catch (err) {
    console.warn('Could not cache file in P2P Swarm:', err);
  }
}

/**
 * Checks if a file is already cached in the local P2P Swarm
 */
export async function getFileFromCommunitySwarm(fileId: string): Promise<Blob | null> {
  const stats = getCommunityNodeStats();
  if (!stats.isActive) return null;

  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const url = `/p2p-cache/${encodeURIComponent(fileId)}`;
      const response = await cache.match(url);
      if (response) {
        const blob = await response.blob();
        // Increment relay transfer count
        stats.relayedTransfersCount += 1;
        saveCommunityNodeStats(stats);
        return blob;
      }
    }
  } catch (err) {
    console.warn('Error reading from P2P Swarm cache:', err);
  }
  return null;
}

/**
 * Clears the local P2P Community Cache
 */
export async function clearCommunitySwarmCache(): Promise<void> {
  try {
    if ('caches' in window) {
      await caches.delete(CACHE_NAME);
    }
    const stats = getCommunityNodeStats();
    stats.usedCacheBytes = 0;
    stats.sharedFilesCount = 0;
    saveCommunityNodeStats(stats);
  } catch (err) {
    console.warn('Failed to clear community swarm cache:', err);
  }
}
