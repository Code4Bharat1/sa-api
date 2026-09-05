import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITrainingAcknowledgment extends Document {
  technicianId: Types.ObjectId;
  clientName: string;
  institutionName: string;
  trainingDate?: Date;
  trainersPresentCount?: number;
  traineeNames?: string;
  clientEmail: string;
  signatureImage: string;
  trainingImage: string;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingAcknowledgmentSchema = new Schema<ITrainingAcknowledgment>(
  {
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientName: { type: String, required: true, trim: true },
    institutionName: { type: String, required: true, trim: true },
    trainingDate: { type: Date, default: Date.now },
    trainersPresentCount: { type: Number, default: 1, min: 1 },
    traineeNames: { type: String, default: '', trim: true },
    clientEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    signatureImage: { type: String, required: true },
    trainingImage: { type: String, required: true },
  },
  { timestamps: true }
);

export const TrainingAcknowledgment = mongoose.model<ITrainingAcknowledgment>(
  'TrainingAcknowledgment',
  TrainingAcknowledgmentSchema
);
