import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITrainingAcknowledgment extends Document {
  technicianId: Types.ObjectId;
  clientName: string;
  institutionName: string;
  trainersPresentCount: number;
  traineeNames: string;
  clientEmail: string;
  signatureImage: string;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingAcknowledgmentSchema = new Schema<ITrainingAcknowledgment>(
  {
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientName: { type: String, required: true, trim: true },
    institutionName: { type: String, required: true, trim: true },
    trainersPresentCount: { type: Number, required: true, min: 1 },
    traineeNames: { type: String, required: true, trim: true },
    clientEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    signatureImage: { type: String, required: true },
  },
  { timestamps: true }
);

export const TrainingAcknowledgment = mongoose.model<ITrainingAcknowledgment>(
  'TrainingAcknowledgment',
  TrainingAcknowledgmentSchema
);
