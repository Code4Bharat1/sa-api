import mongoose, { Document, Schema } from 'mongoose';
import { Role, ROLES } from '../config/constants.js';

export interface IPanel {
  serialNumber: string;
  size: string;
  installationDate: Date;
}

export interface IUser extends Document {
  customerId: string;
  name: string;
  mobileNumber?: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  profileComplete: boolean;
  organizationName?: string;
  address?: string;
  city?: string;
  state?: string;
  panels: IPanel[];
  role: Role;
  isActive: boolean;
  refreshTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PanelSchema = new Schema<IPanel>({
  serialNumber: { type: String, required: true },
  size: { type: String, required: true },
  installationDate: { type: Date, required: true },
});

const UserSchema = new Schema<IUser>(
  {
    customerId: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    mobileNumber: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true },
    passwordHash: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    profileComplete: { type: Boolean, default: true },
    organizationName: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    panels: [PanelSchema],
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CUSTOMER,
    },
    isActive: { type: Boolean, default: true },
    refreshTokenHash: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
