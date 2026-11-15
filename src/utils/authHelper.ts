/**
 * Utility functions for local and Firestore-backed authentication
 */

export interface CustomAuthAccount {
  uid: string;
  email: string;
  linkedEmail?: string;
  phone?: string;
  linkedPhone?: string;
  linkedUids?: string[];
  googleUid?: string;
  username?: string;
  dob?: string;
  gender?: 'Nam' | 'Nữ' | 'Không Muốn Trả Lời' | string;
  passwordHash: string;
  salt: string;
  displayName: string;
  deviceName?: string;
  deviceType?: string;
  avatarColor?: string;
  createdAt: string;
}

export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  let cleaned = phone.trim().replace(/[\s\-().]/g, '');
  if (!cleaned) return '';
  // Normalize common Vietnamese local format 0xxxxxxxxx -> +84xxxxxxxxx
  if (/^0\d{8,10}$/.test(cleaned)) {
    cleaned = '+84' + cleaned.slice(1);
  } else if (/^84\d{8,10}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  } else if (/^\+0\d+$/.test(cleaned)) {
    cleaned = '+' + cleaned.slice(2);
  }
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 7) return '';
  return cleaned.startsWith('+') ? `+${digitsOnly}` : digitsOnly;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getAccountKey(identifier: string): Promise<string> {
  const normalized = identifier.trim().toLowerCase();
  const enc = new TextEncoder();
  const data = enc.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return 'acc_' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 48);
}

export const getEmailKey = getAccountKey;

export function generateSalt(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function generateUid(): string {
  return 'u_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}
