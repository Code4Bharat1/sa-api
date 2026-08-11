import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { AppError } from '../middlewares/error.middleware.js';
import { TrainingAcknowledgment } from '../models/TrainingAcknowledgment.js';
import { User } from '../models/User.js';
import { sendEmail } from '../services/notification.service.js';
import { ROLES } from '../config/constants.js';
import { logger } from '../utils/logger.js';

const escapeHtml = (str: string) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createAcknowledgment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { clientName, institutionName, trainersPresentCount, traineeNames, clientEmail, signatureImage } = req.body;

    if (!clientName || !institutionName || !trainersPresentCount || !traineeNames || !clientEmail || !signatureImage) {
      throw new AppError('All fields including digital signature are required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail.trim())) {
      throw new AppError('Invalid client email address format', 400);
    }

    const technician = await User.findById(req.user!.userId);
    const techName = technician ? technician.name : 'Field Technician';

    const ack = await TrainingAcknowledgment.create({
      technicianId: req.user!.userId,
      clientName: clientName.trim(),
      institutionName: institutionName.trim(),
      trainersPresentCount: Number(trainersPresentCount),
      traineeNames: traineeNames.trim(),
      clientEmail: clientEmail.trim(),
      signatureImage,
    });

    const safeClientName = escapeHtml(clientName.trim());
    const safeInstName = escapeHtml(institutionName.trim());
    const safeTraineeNames = escapeHtml(traineeNames.trim());
    const safeTechName = escapeHtml(techName);

    // Send email to client
    const emailSubject = `Training Completion Acknowledgment - ${institutionName.trim()}`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #334155; background-color: #f8fafc; margin: 0; padding: 20px; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: #0D1A4B; color: #C99F0F; padding: 24px; text-align: center; }
          .header h2 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
          .body { padding: 32px; }
          .field-group { margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
          .label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
          .value { font-size: 15px; font-weight: 500; color: #0f172a; }
          .signature-box { margin-top: 24px; padding: 16px; background: #0f172a; border: 1px dashed #334155; border-radius: 8px; text-align: center; }
          .signature-box .label { color: #94a3b8; }
          .signature-box img { max-width: 280px; max-height: 120px; height: auto; }
          .footer { background: #0D1A4B; color: #C99F0F; padding: 16px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2>Nexcore Alliance</h2>
            <p style="margin: 4px 0 0; font-size: 13px; color: #e2e8f0;">Training Completion Acknowledgment</p>
          </div>
          <div class="body">
            <p>Dear <strong>${safeClientName}</strong>,</p>
            <p>This email confirms that the training session conducted at <strong>${safeInstName}</strong> has been completed successfully.</p>
            
            <div class="field-group">
              <div class="label">Institution Name</div>
              <div class="value">${safeInstName}</div>
            </div>
            <div class="field-group">
              <div class="label">Client Representative</div>
              <div class="value">${safeClientName}</div>
            </div>
            <div class="field-group">
              <div class="label">Trainers Present During Training</div>
              <div class="value">${trainersPresentCount}</div>
            </div>
            <div class="field-group">
              <div class="label">Trainee Name(s)</div>
              <div class="value">${safeTraineeNames}</div>
            </div>
            <div class="field-group">
              <div class="label">Conducting Technician</div>
              <div class="value">${safeTechName}</div>
            </div>

            <div class="signature-box">
              <div class="label">Captured Digital Signature</div>
              <img src="cid:client_digital_signature" alt="Digital Signature" style="max-width: 280px; max-height: 120px;" />
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Student Alliance. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    const base64Data = signatureImage.replace(/^data:image\/\w+;base64,/, '');
    const signatureBuffer = Buffer.from(base64Data, 'base64');
    const attachments = [
      {
        filename: 'digital-signature.png',
        content: signatureBuffer,
        cid: 'client_digital_signature',
      },
    ];

    try {
      await sendEmail(clientEmail, emailSubject, emailHtml, attachments);
      logger.info(`Training Acknowledgment email sent to ${clientEmail}`);
    } catch (mailErr) {
      logger.error(`Failed to send acknowledgment email to ${clientEmail}`, mailErr);
    }

    res.status(201).json({ success: true, data: ack });
  } catch (err) {
    next(err);
  }
};

export const listAcknowledgments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role, userId } = req.user!;
    const { search } = req.query;

    const filter: any = {};

    if (role === ROLES.TECHNICIAN) {
      filter.technicianId = userId;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = escapeRegex(search.trim());
      filter.$or = [
        { clientName: { $regex: q, $options: 'i' } },
        { institutionName: { $regex: q, $options: 'i' } },
        { traineeNames: { $regex: q, $options: 'i' } },
        { clientEmail: { $regex: q, $options: 'i' } },
      ];
    }

    const acknowledgments = await TrainingAcknowledgment.find(filter)
      .populate('technicianId', 'name email mobileNumber')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: acknowledgments.length, data: acknowledgments });
  } catch (err) {
    next(err);
  }
};

export const getAcknowledgment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ack = await TrainingAcknowledgment.findById(req.params.id)
      .populate('technicianId', 'name email mobileNumber');

    if (!ack) {
      throw new AppError('Training acknowledgment not found', 404);
    }

    // Technicians can only view their own
    if (req.user!.role === ROLES.TECHNICIAN && ack.technicianId._id.toString() !== req.user!.userId) {
      throw new AppError('Forbidden', 403);
    }

    res.json({ success: true, data: ack });
  } catch (err) {
    next(err);
  }
};
