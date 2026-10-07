import { z } from 'zod';

export const createInventorySchema = z.object({
  // Vendor Info
  vendorName: z.string().trim().min(1, 'Vendor name is required'),
  vendorEmail: z.string().trim().email('Invalid vendor email').nullable().optional().or(z.literal('')),
  vendorPhone: z.string().trim().nullable().optional().or(z.literal('')),
  purchaseDate: z.string().trim().nullable().optional().or(z.literal('')),
  purchaseInvoiceNo: z.string().trim().nullable().optional().or(z.literal('')),

  // Panel Info
  panelSerialNumber: z.string().trim().min(1, 'Panel serial number is required'),
  panelBrand: z.string().trim().nullable().optional().or(z.literal('')),
  panelSize: z.string().trim().nullable().optional().or(z.literal('')),
  warrantyPeriod: z.string().trim().nullable().optional().or(z.literal('')),

  // Customer Info
  customerName: z.string().trim().min(1, 'Customer name is required'),
  customerEmail: z.string().trim().email('Invalid customer email').nullable().optional().or(z.literal('')),
  customerPhone: z.string().trim().nullable().optional().or(z.literal('')),
  customerOrganization: z.string().trim().nullable().optional().or(z.literal('')),
  saleDate: z.string().trim().nullable().optional().or(z.literal('')),
  saleInvoiceNo: z.string().trim().nullable().optional().or(z.literal('')),
  remarks: z.string().trim().max(1000, 'Remarks cannot exceed 1000 characters').nullable().optional().or(z.literal('')),
});

export const updateInventorySchema = createInventorySchema.partial();

export const inventoryFilterSchema = z.object({
  search: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
