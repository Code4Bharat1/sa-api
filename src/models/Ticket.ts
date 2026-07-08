import mongoose, { Document, Schema, Types } from 'mongoose';
import { TICKET_STATUS, TicketStatus, ISSUE_CATEGORIES, IssueCategory, PRIORITY, Priority } from '../config/constants.js';

export interface IStatusHistory {
  status: TicketStatus;
  changedBy: Types.ObjectId;
  timestamp: Date;
  remarks?: string;
}

export interface IResolution {
  workPerformed: string;
  partsUsed: string[];
  images: string[];
  customerSignature?: string;
  remarks?: string;
  resolvedAt: Date;
}

export interface IFeedback {
  rating: number;
  comment?: string;
  submittedAt: Date;
}

export interface IReopenStatus {
  isReopened: boolean;
  reopenCount: number;
  reasons: { reason: string; reopenedAt: Date }[];
}

export interface ITicket extends Document {
  ticketId: string;
  customerId: Types.ObjectId;
  panelSerialNumber: string;
  issueCategory: IssueCategory;
  description: string;
  priority: Priority;
  attachments: string[];
  status: TicketStatus;
  statusHistory: IStatusHistory[];
  assignedTeam?: string;
  assignedTechnician?: Types.ObjectId;
  scheduledVisitDate?: Date;
  expectedResponseTime?: Date;
  expectedResolutionTime?: Date;
  resolutionDeadline?: Date;
  assignedAt?: Date;
  resolution?: IResolution;
  closedAt?: Date;
  feedback?: IFeedback;
  reopenStatus: IReopenStatus;
  isOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StatusHistorySchema = new Schema<IStatusHistory>({
  status: { type: String, required: true },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
  remarks: { type: String },
});

const ResolutionSchema = new Schema<IResolution>({
  workPerformed: { type: String, required: true },
  partsUsed: [{ type: String }],
  images: [{ type: String }],
  customerSignature: { type: String },
  remarks: { type: String },
  resolvedAt: { type: Date, default: Date.now },
});

const FeedbackSchema = new Schema<IFeedback>({
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  submittedAt: { type: Date, default: Date.now },
});

const TicketSchema = new Schema<ITicket>(
  {
    ticketId: { type: String, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    panelSerialNumber: { type: String, required: true, index: true },
    issueCategory: { type: String, enum: ISSUE_CATEGORIES, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: Object.values(PRIORITY), default: PRIORITY.MEDIUM },
    attachments: [{ type: String }],
    status: {
      type: String,
      enum: Object.values(TICKET_STATUS),
      default: TICKET_STATUS.OPEN,
      index: true,
    },
    statusHistory: [StatusHistorySchema],
    assignedTeam: { type: String },
    assignedTechnician: { type: Schema.Types.ObjectId, ref: 'User' },
    scheduledVisitDate: { type: Date },
    expectedResponseTime: { type: Date },
    expectedResolutionTime: { type: Date },
    resolutionDeadline: { type: Date },
    assignedAt: { type: Date },
    resolution: ResolutionSchema,
    closedAt: { type: Date },
    feedback: FeedbackSchema,
    reopenStatus: {
      isReopened: { type: Boolean, default: false },
      reopenCount: { type: Number, default: 0 },
      reasons: [
        {
          reason: { type: String },
          reopenedAt: { type: Date, default: Date.now },
        },
      ],
    },
    isOverdue: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
