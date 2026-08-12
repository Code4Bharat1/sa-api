import { z } from 'zod';

export const createAcknowledgmentSchema = z.object({
  clientName: z.string().trim().min(2, 'Client name must be at least 2 characters').max(100, 'Client name must be at most 100 characters'),
  institutionName: z.string().trim().min(2, 'Institution name must be at least 2 characters').max(150, 'Institution name must be at most 150 characters'),
  trainersPresentCount: z.number().int({ message: 'Trainers count must be a whole number' }).min(1, 'At least 1 trainer must be present'),
  traineeNames: z.string().trim().min(2, 'Trainee name(s) are required').max(1000, 'Trainee names cannot exceed 1000 characters'),
  clientEmail: z.string().trim().email('Invalid client email address format'),
  signatureImage: z
    .string()
    .min(20, 'Digital signature is required')
    .refine((val) => val.startsWith('data:image/'), {
      message: 'Digital signature must be a valid image data URL',
    }),
  trainingImage: z
    .string()
    .min(20, 'Training session photo is required')
    .refine((val) => val.startsWith('data:image/'), {
      message: 'Training session photo must be a valid image data URL',
    }),
});
