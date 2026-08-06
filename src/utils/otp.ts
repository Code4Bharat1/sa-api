import crypto from 'crypto';
import { env } from '../config/env.js';
import { OTP } from '../models/OTP.js';

export const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const createOTPRecord = async (identifier: string, code: string) => {
  await OTP.deleteMany({ identifier });
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);
  return OTP.create({ identifier, code, expiresAt });
};

export const validateOTPRecord = async (identifier: string, code: string): Promise<boolean> => {
  const record = await OTP.findOne({ identifier, verified: false }).sort({ createdAt: -1 });
  if (!record) return false;
  if (record.expiresAt < new Date()) return false;
  if (record.attempts >= 5) return false;

  record.attempts += 1;
  const valid = record.code === code;
  if (valid) {
    record.verified = true;
  }
  await record.save();
  return valid;
};

export const generateSecureToken = (): string =>
  crypto.randomBytes(32).toString('hex');
