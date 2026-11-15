import { ChatMessage } from '../types';

interface RoomCacheEntry {
  messages: ChatMessage[];
  hasMore: boolean;
  updatedAt: number;
}

const MAX_MEMORY_ROOMS = 24;
const MAX_CACHED_MESSAGES = 35;
const STORAGE_PREFIX = 'clsend_room_cache_v1_';

const memoryCache = new Map<string, RoomCacheEntry>();

function sanitizeMessageForStorage(msg: ChatMessage): ChatMessage {
  const safeFileData =
    msg.fileData && msg.fileData.startsWith('data:') && msg.fileData.length > 24_000
      ? ''
      : msg.fileData;

  const safeAttachments = Array.isArray(msg.attachments)
    ? msg.attachments.map((att) => ({
        ...att,
        data:
          att.data && att.data.startsWith('data:') && att.data.length > 24_000
            ? ''
            : att.data,
      }))
    : undefined;

  return {
    ...msg,
    serverTimestamp: undefined,
    fileData: safeFileData,
    ...(safeAttachments ? { attachments: safeAttachments } : {}),
  };
}

export function getCachedRoomMessages(
  roomId: string
): { messages: ChatMessage[]; hasMore: boolean } | null {
  if (!roomId) return null;

  const mem = memoryCache.get(roomId);
  if (mem) {
    // Refresh LRU position
    memoryCache.delete(roomId);
    memoryCache.set(roomId, mem);
    return { messages: mem.messages, hasMore: mem.hasMore };
  }

  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${roomId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoomCacheEntry;
    if (parsed && Array.isArray(parsed.messages)) {
      memoryCache.set(roomId, parsed);
      return { messages: parsed.messages, hasMore: Boolean(parsed.hasMore) };
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

export function setCachedRoomMessages(
  roomId: string,
  messages: ChatMessage[],
  hasMore: boolean
): void {
  if (!roomId) return;

  // Keep latest window only (strip optimistic temp-* messages from durable cache)
  const confirmed = messages
    .filter((m) => m && m.id && !m.id.startsWith('temp-') && !m.deletedBySender && !m.isDeletedBySender)
    .slice(-MAX_CACHED_MESSAGES);

  const entry: RoomCacheEntry = {
    messages: confirmed,
    hasMore,
    updatedAt: Date.now(),
  };

  if (memoryCache.has(roomId)) {
    memoryCache.delete(roomId);
  } else if (memoryCache.size >= MAX_MEMORY_ROOMS) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(roomId, entry);

  if (typeof window === 'undefined') return;
  try {
    const compact: RoomCacheEntry = {
      messages: confirmed.map(sanitizeMessageForStorage),
      hasMore,
      updatedAt: entry.updatedAt,
    };
    localStorage.setItem(`${STORAGE_PREFIX}${roomId}`, JSON.stringify(compact));
  } catch {
    // Ignore quota exceeded errors
  }
}

export function removeCachedRoomMessage(roomId: string, messageId: string): void {
  if (!roomId || !messageId) return;
  const mem = memoryCache.get(roomId);
  if (mem) {
    mem.messages = mem.messages.filter((m) => m.id !== messageId);
  }
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${roomId}`);
    if (!raw) return;
    const parsed = JSON.parse(raw) as RoomCacheEntry;
    if (parsed && Array.isArray(parsed.messages)) {
      parsed.messages = parsed.messages.filter((m) => m.id !== messageId);
      localStorage.setItem(`${STORAGE_PREFIX}${roomId}`, JSON.stringify(parsed));
    }
  } catch {}
}

export function clearCachedRoomMessages(roomId: string): void {
  if (!roomId) return;
  memoryCache.delete(roomId);
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${roomId}`);
  } catch {}
}
