import mongoose, { Document, Schema, Types } from 'mongoose';

export type DeliveryStatus = 'Scheduled' | 'Dispatched' | 'Out for Delivery' | 'Delivered' | 'Cancelled';

export interface IDelivery extends Document {
  adminId: Types.ObjectId;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  googleMapLink?: string;
  productName: string;
  deliveryAgentName: string;
  deliveryAgentPhone: string;
  deliveryAgentEmail: string;
  deliveryDate: string;
  estimateTime: string;
  status: DeliveryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const DeliverySchema = new Schema<IDelivery>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    customerPhone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    googleMapLink: { type: String, trim: true },
    productName: { type: String, required: true, trim: true },
    deliveryAgentName: { type: String, required: true, trim: true },
    deliveryAgentPhone: { type: String, required: true, trim: true },
    deliveryAgentEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    deliveryDate: { type: String, required: true, trim: true },
    estimateTime: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['Scheduled', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'],
      default: 'Scheduled',
      index: true,
    },
  },
  { timestamps: true }
);

export const Delivery = mongoose.model<IDelivery>('Delivery', DeliverySchema);
