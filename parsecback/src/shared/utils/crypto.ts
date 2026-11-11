import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const ALGO = 'aes-256-gcm'; // AES-GCM
const IV_LEN = 12; // 96 бит для GCM
const KEY_HEX_LEN = 32; // 16 байт -> 32 hex символа (твой формат)

function getMasterKey(): Buffer {
  const hex = process.env.API_KEY_ENC_SECRET;
  if (!hex) throw new Error('API_KEY_ENC_SECRET is not set');
  const buf = Buffer.from(hex, 'hex'); // ожидаем 32 байта в hex (64 символа)
  if (buf.length !== 32)
    throw new Error('API_KEY_ENC_SECRET must be 32 bytes (64 hex chars)');
  return buf;
}

export function generateShortApiKey(): string {
  return randomBytes(KEY_HEX_LEN / 2).toString('hex'); // 16 байт -> 32 hex
}

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Шифруем «сырой» ключ для отображения в профиле (base64: iv|cipher|tag) */
export function encryptWithMaster(plainText: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Сохраняем как base64: iv|cipher|tag
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

/** Дешифруем для отображения клиенту в профиле */
export function decryptWithMaster(b64: string): string {
  const raw = Buffer.from(b64, 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(raw.length - 16);
  const enc = raw.subarray(IV_LEN, raw.length - 16);
  const key = getMasterKey();

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}
