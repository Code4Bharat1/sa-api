import { z } from 'zod';
import { ISSUE_CATEGORIES, PRIORITY, TICKET_STATUS } from '../config/constants.js';

export const createTicketSchema = z.object({
  panelSerialNumber: z.string().min(1),
  issueCategory: z.enum(ISSUE_CATEGORIES),
  description: z.string().min(10).max(2000),
  priority: z.enum([PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.HIGH, PRIORITY.CRITICAL]).optional(),
  attachments: z.array(z.string()).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(Object.values(TICKET_STATUS) as [string, ...string[]]),
  remarks: z.string().max(500).optional(),
  scheduledVisitDate: z.string().optional(),
});

export const assignTicketSchema = z.object({
  assignedTechnician: z.string().optional(),
  assignedTeam: z.string().optional(),
});

export const resolutionSchema = z.object({
  workPerformed: z.string().min(5).max(2000),
  partsUsed: z.array(z.string()).optional(),
  remarks: z.string().max(500).optional(),
  customerSignature: z.string().optional(),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const reopenSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const ticketFilterSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  issueCategory: z.string().optional(),
  panelSerialNumber: z.string().optional(),
  assignedTechnician: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

export const updatePrioritySchema = z.object({
  priority: z.enum([PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.HIGH, PRIORITY.CRITICAL]),
});

export const updateDeadlineSchema = z.object({
  resolutionDeadline: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid deadline date format',
  }),
});
