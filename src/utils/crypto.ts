import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

const getSecretKey = (): Buffer => {
  const hexKey = env.CHAT_ENCRYPTION_KEY;
  if (hexKey.length === 64) {
    return Buffer.from(hexKey, 'hex');
  }
  return crypto.createHash('sha256').update(hexKey).digest();
};

export const encryptText = (text: string): string => {
  if (!text) return text;
  try {
    const key = getSecretKey();
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    const ivHex = iv.toString('hex');

    return `${PREFIX}${ivHex}:${authTag}:${encrypted}`;
  } catch (err) {
    return text;
  }
};

export const decryptText = (cipherText: string): string => {
  if (!cipherText || !cipherText.startsWith(PREFIX)) {
    return cipherText;
  }

  try {
    const raw = cipherText.slice(PREFIX.length);
    const parts = raw.split(':');
    if (parts.length !== 3) return cipherText;

    const [ivHex, authTagHex, encryptedHex] = parts;

    const key = getSecretKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    return '[Encrypted Message]';
  }
};
