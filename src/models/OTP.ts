import mongoose, { Document, Schema } from 'mongoose';

export interface IOTP extends Document {
  identifier: string;
  code: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
}

const OTPSchema = new Schema<IOTP>({
  identifier: { type: String, required: true, index: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
});

OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTP = mongoose.model<IOTP>('OTP', OTPSchema);
