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
    const { clientName, institutionName, trainingDate, trainersPresentCount, traineeNames, clientEmail, signatureImage, trainingImage } = req.body;

    if (!clientName || !institutionName || !clientEmail || !signatureImage || !trainingImage) {
      throw new AppError('Client name, institution, email, session photo, and digital signature are required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail.trim())) {
      throw new AppError('Invalid client email address format', 400);
    }

    const authorUser = await User.findById(req.user!.userId);
    const techName = authorUser
      ? authorUser.name
      : (req.user!.role === ROLES.ADMIN ? 'Administrator' : 'Field Technician');

    const ack = await TrainingAcknowledgment.create({
      technicianId: req.user!.userId,
      clientName: clientName.trim(),
      institutionName: institutionName.trim(),
      trainingDate: trainingDate ? new Date(trainingDate) : new Date(),
      trainersPresentCount: trainersPresentCount ? Number(trainersPresentCount) : 1,
      traineeNames: traineeNames ? traineeNames.trim() : '',
      clientEmail: clientEmail.trim(),
      signatureImage,
      trainingImage,
    });

    const safeClientName = escapeHtml(clientName.trim());
    const safeInstName = escapeHtml(institutionName.trim());
    const safeTraineeNames = traineeNames && traineeNames.trim() ? escapeHtml(traineeNames.trim()) : 'Not specified';
    const safeTechName = escapeHtml(techName);

    // Send email to client
    const emailSubject = `Training Completion Acknowledgment - ${institutionName.trim()}`;
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en" xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>${emailSubject}</title>
        <style type="text/css">
          body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
          table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
          img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
          body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          * { box-sizing: border-box; }
          
          @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; margin: 0 auto !important; border-radius: 0 !important; }
            .content-cell { padding: 24px 16px !important; }
            .header-cell { padding: 24px 16px !important; }
            .media-box { padding: 12px !important; margin-top: 12px !important; }
            .responsive-img { width: 100% !important; max-width: 100% !important; height: auto !important; }
            .stat-cell { display: block !important; width: 100% !important; padding: 6px 0 !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 20px 0; background-color: #f1f5f9;">
        <!-- Center wrapper -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding: 10px;">
              
              <!-- Card Container (Max 600px) -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
                
                <!-- Brand Header -->
                <tr>
                  <td class="header-cell" style="background: linear-gradient(135deg, #0D1A4B 0%, #172A68 100%); padding: 32px 28px; text-align: center; border-bottom: 4px solid #C99F0F;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #C99F0F;">NEXCORE ALLIANCE</h1>
                    <p style="margin: 6px 0 0 0; font-size: 13px; font-weight: 500; letter-spacing: 0.5px; color: #e2e8f0;">Training Completion Acknowledgment</p>
                  </td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td class="content-cell" style="padding: 32px 28px; color: #334155;">
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5; color: #0f172a;">
                      Dear <strong>${safeClientName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #475569;">
                      This is an official confirmation that the product training session conducted at <strong style="color: #0f172a;">${safeInstName}</strong> has been completed successfully.
                    </p>

                    <!-- Details Summary Box -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; overflow: hidden;">
                      <tr>
                        <td style="padding: 16px 20px; border-bottom: 1px solid #edf2f7;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px;">Institution / Organization</div>
                          <div style="font-size: 15px; font-weight: 700; color: #0D1A4B;">${safeInstName}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 20px; border-bottom: 1px solid #edf2f7;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px;">Client Representative</div>
                          <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${safeClientName}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 20px; border-bottom: 1px solid #edf2f7;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px;">Training Date</div>
                          <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${(trainingDate ? new Date(trainingDate) : new Date()).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 20px; border-bottom: 1px solid #edf2f7;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px;">Trainers Present Count</div>
                          <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${trainersPresentCount ? Number(trainersPresentCount) : 1} Trainer(s)</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 20px; border-bottom: 1px solid #edf2f7;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px;">Trainee Name(s)</div>
                          <div style="font-size: 13px; font-weight: 500; color: #334155; line-height: 1.5;">${safeTraineeNames}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 20px;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px;">Conducted By</div>
                          <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${safeTechName}</div>
                        </td>
                      </tr>
                    </table>

                    <!-- Media: Session Photo Box -->
                    <div class="media-box" style="background-color: #f8fafc; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 18px; border: 1px solid #e2e8f0;">
                      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #475569; margin-bottom: 12px;">Captured Training Session Photo</div>
                      <img src="cid:training_session_photo" alt="Training Session Photo" class="responsive-img" style="max-width: 100%; max-height: 240px; height: auto; border-radius: 8px; border: 1px solid #cbd5e1; object-fit: contain; margin: 0 auto; display: block;" />
                    </div>

                    <!-- Media: Digital Signature Box -->
                    <div class="media-box" style="background-color: #f8fafc; border-radius: 12px; padding: 18px; text-align: center; border: 1px solid #e2e8f0;">
                      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #475569; margin-bottom: 12px;">Captured Client Digital Signature</div>
                      <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; display: inline-block; width: 100%; max-width: 360px;">
                        <img src="cid:client_digital_signature" alt="Digital Signature" class="responsive-img" style="max-width: 100%; max-height: 120px; height: auto; object-fit: contain; margin: 0 auto; display: block;" />
                      </div>
                    </div>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #0D1A4B; padding: 22px 20px; text-align: center; border-top: 1px solid #1e2e6e;">
                    <p style="margin: 0; font-size: 12px; font-weight: 500; color: #C99F0F;">
                      &copy; ${new Date().getFullYear()} Nexcore Alliance / Student Alliance LLP. All rights reserved.
                    </p>
                    <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                      This is an automated training completion record generated from the IFPD Support System.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const signatureBase64 = signatureImage.replace(/^data:image\/\w+;base64,/, '');
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');
    const photoBase64 = trainingImage.replace(/^data:image\/\w+;base64,/, '');
    const photoBuffer = Buffer.from(photoBase64, 'base64');

    const attachments = [
      {
        filename: 'digital-signature.png',
        content: signatureBuffer,
        cid: 'client_digital_signature',
      },
      {
        filename: 'training-session-photo.png',
        content: photoBuffer,
        cid: 'training_session_photo',
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

export const updateAcknowledgmentDate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { trainingDate } = req.body;
    if (!trainingDate || isNaN(Date.parse(trainingDate))) {
      throw new AppError('Valid training date is required', 400);
    }

    const ack = await TrainingAcknowledgment.findById(req.params.id);
    if (!ack) {
      throw new AppError('Training acknowledgment not found', 404);
    }

    ack.trainingDate = new Date(trainingDate);
    await ack.save();
    await ack.populate('technicianId', 'name email mobileNumber');

    res.json({ success: true, message: 'Training date updated successfully', data: ack });
  } catch (err) {
    next(err);
  }
};
