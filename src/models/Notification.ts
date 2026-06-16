import mongoose, { Document, Schema, Types } from 'mongoose';
import { NOTIFICATION_CHANNELS } from '../config/constants.js';

export interface INotification extends Document {
  ticketId?: Types.ObjectId;
  recipient: Types.ObjectId;
  channel: string;
  subject?: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: String, enum: Object.values(NOTIFICATION_CHANNELS), required: true },
    subject: { type: String },
    message: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    sentAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
