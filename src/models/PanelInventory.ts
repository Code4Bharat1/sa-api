import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPanelInventory extends Document {
  adminId: Types.ObjectId;

  // Vendor Information (Purchase)
  vendorName: string;
  vendorEmail?: string;
  vendorPhone?: string;
  purchaseDate?: string;
  purchaseInvoiceNo?: string;

  // Panel Information (Hardware specs)
  panelSerialNumber: string;
  panelBrand?: string;
  panelSize?: string;
  warrantyPeriod?: string;

  // Customer Information (Sales)
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerOrganization?: string;
  saleDate?: string;
  saleInvoiceNo?: string;
  remarks?: string;

  createdAt: Date;
  updatedAt: Date;
}

const PanelInventorySchema = new Schema<IPanelInventory>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Vendor Information
    vendorName: { type: String, required: true, trim: true },
    vendorEmail: { type: String, trim: true, lowercase: true },
    vendorPhone: { type: String, trim: true },
    purchaseDate: { type: String, trim: true },
    purchaseInvoiceNo: { type: String, trim: true },

    // Panel Information
    panelSerialNumber: { type: String, required: true, unique: true, trim: true, index: true },
    panelBrand: { type: String, trim: true },
    panelSize: { type: String, trim: true },
    warrantyPeriod: { type: String, trim: true },

    // Customer Information
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true, lowercase: true },
    customerPhone: { type: String, trim: true },
    customerOrganization: { type: String, trim: true },
    saleDate: { type: String, trim: true },
    saleInvoiceNo: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

export const PanelInventory = mongoose.model<IPanelInventory>('PanelInventory', PanelInventorySchema);
