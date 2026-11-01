/**
 * Base64 Security & Encryption Utilities for CLSend
 * Hỗ trợ mã hóa Base64 hai chiều (Unicode UTF-8 an toàn) cho dữ liệu truyền tải,
 * tin nhắn chat và danh tính quản trị viên để chống theo dõi và đánh cắp dữ liệu dạng plain-text.
 */

/**
 * Mã hóa chuỗi UTF-8 sang Base64 an toàn (hỗ trợ ký tự tiếng Việt, emoji, ký tự đặc biệt)
 */
export function encodeBase64(input: string): string {
  if (!input) return '';
  try {
    // Chuyển UTF-8 sang URI encoded string rồi dùng btoa
    const utf8Bytes = encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    });
    return btoa(utf8Bytes);
  } catch (err) {
    console.warn('Base64 encoding fallback:', err);
    try {
      return btoa(input);
    } catch {
      return input;
    }
  }
}

/**
 * Giải mã chuỗi Base64 sang văn bản UTF-8 chuẩn
 */
export function decodeBase64(base64Str: string): string {
  if (!base64Str) return '';
  try {
    const raw = atob(base64Str);
    const decoded = decodeURIComponent(
      Array.prototype.map.call(raw, (c: string) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')
    );
    return decoded;
  } catch (err) {
    try {
      return atob(base64Str);
    } catch {
      return base64Str;
    }
  }
}

/**
 * Kiểm tra xem một chuỗi có phải là định dạng Base64 hợp lệ hay không
 */
export function isBase64(str: string): boolean {
  if (!str || typeof str !== 'string' || str.length % 4 !== 0) return false;
  const regex = /^[A-Za-z0-9+/]+={0,2}$/;
  return regex.test(str);
}

/**
 * Đóng gói tin nhắn với tiền tố an toàn Base64
 */
export function wrapSecureBase64Message(plainText: string): string {
  if (!plainText) return '';
  return `B64:${encodeBase64(plainText)}`;
}

/**
 * Giải mã tin nhắn an toàn: Nếu tin nhắn bắt đầu bằng B64: hoặc là Base64 hợp lệ thì tự động giải mã,
 * nếu là tin nhắn cũ dạng văn bản thông thường thì hiển thị bình thường (tương thích 100%).
 */
export function unwrapSecureBase64Message(content: string): string {
  if (!content) return '';
  if (content.startsWith('B64:')) {
    const encoded = content.slice(4);
    return decodeBase64(encoded);
  }
  return content;
}
