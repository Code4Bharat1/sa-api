import { z } from 'zod';

const panelSchema = z.object({
  serialNumber: z.string().min(1),
  size: z.string().min(1),
  installationDate: z.string().datetime(),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  mobileNumber: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid mobile number'),
  email: z.string().email(),
  password: z.string().min(8, 'Password is required (min 8 characters)'),
  organizationName: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  panels: z.array(panelSchema).min(1, 'At least one IFPD panel is required'),
});

export const completeProfileSchema = z.object({
  password: z.string().min(8).optional(),
  mobileNumber: z.string().min(10).optional(),
  organizationName: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  panels: z.array(panelSchema).min(1, 'At least one IFPD panel is required'),
});

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const otpRequestSchema = z.object({
  identifier: z.string().min(1),
});

export const otpVerifySchema = z.object({
  identifier: z.string().min(1),
  code: z.string().length(6),
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});
