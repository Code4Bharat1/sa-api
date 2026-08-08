import mongoose, { Document, Schema, Types } from 'mongoose';
import { encryptText, decryptText } from '../utils/crypto.js';

export interface IReplyTo {
  messageId: string;
  senderName: string;
  senderRole: 'customer' | 'admin' | 'technician';
  message: string;
}

export interface ITicketMessage extends Document {
  ticketId: string;
  senderId: Types.ObjectId;
  senderRole: 'customer' | 'admin' | 'technician';
  senderName: string;
  message: string;
  attachments?: string[];
  replyTo?: IReplyTo;
  readBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const TicketMessageSchema = new Schema<ITicketMessage>(
  {
    ticketId: { type: String, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['customer', 'admin', 'technician'], required: true },
    senderName: { type: String, required: true },
    message: {
      type: String,
      default: '',
      set: encryptText,
      get: decryptText,
    },
    attachments: [
      {
        type: String,
        set: encryptText,
        get: decryptText,
      },
    ],
    replyTo: {
      messageId: { type: String },
      senderName: { type: String },
      senderRole: { type: String, enum: ['customer', 'admin', 'technician'] },
      message: { type: String, set: encryptText, get: decryptText },
    },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

export const TicketMessage = mongoose.model<ITicketMessage>('TicketMessage', TicketMessageSchema);
