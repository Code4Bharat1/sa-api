import { z } from 'zod';

const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,15}$/;

export const createDeliverySchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, 'Customer name must be at least 2 characters')
    .max(100, 'Customer name cannot exceed 100 characters'),
  customerEmail: z
    .string()
    .trim()
    .email('Invalid customer email address format'),
  customerPhone: z
    .string()
    .trim()
    .min(10, 'Customer phone number must have at least 10 digits')
    .regex(phoneRegex, 'Invalid customer phone number format'),
  address: z
    .string()
    .trim()
    .min(5, 'Delivery address must be at least 5 characters')
    .max(500, 'Delivery address cannot exceed 500 characters'),
  googleMapLink: z
    .string()
    .trim()
    .url('Google Map Link must be a valid URL')
    .optional()
    .or(z.literal('')),
  productName: z
    .string()
    .trim()
    .min(2, 'Product name must be at least 2 characters')
    .max(150, 'Product name cannot exceed 150 characters'),
  deliveryAgentName: z
    .string()
    .trim()
    .min(2, 'Delivery agent name must be at least 2 characters')
    .max(100, 'Delivery agent name cannot exceed 100 characters'),
  deliveryAgentPhone: z
    .string()
    .trim()
    .min(10, 'Delivery agent phone must have at least 10 digits')
    .regex(phoneRegex, 'Invalid delivery agent phone number format'),
  deliveryAgentEmail: z
    .string()
    .trim()
    .email('Invalid delivery agent email address format'),
  deliveryDate: z
    .string()
    .trim()
    .min(1, 'Delivery date is required'),
  estimateTime: z
    .string()
    .trim()
    .min(1, 'Estimated delivery time is required')
    .max(50, 'Estimated time text cannot exceed 50 characters'),
  status: z
    .enum(['Scheduled', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'])
    .optional(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['Scheduled', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'], {
    errorMap: () => ({ message: 'Status must be Scheduled, Dispatched, Out for Delivery, Delivered, or Cancelled' }),
  }),
});
