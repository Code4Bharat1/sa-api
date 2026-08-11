import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { env } from '../config/env.js';
import { Notification } from '../models/Notification.js';
import { sseManager } from '../sse/sseManager.js';
import { logger } from '../utils/logger.js';
import { Types } from 'mongoose';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sendWithRetry = async (
  fn: () => Promise<void>,
  notifId: string,
  maxRetries = 3
): Promise<void> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fn();
      await Notification.findByIdAndUpdate(notifId, {
        status: 'sent',
        sentAt: new Date(),
        attempts: attempt,
        lastAttemptAt: new Date(),
      });
      return;
    } catch (err) {
      logger.warn(`Notification attempt ${attempt} failed`, { notifId, err });
      if (attempt === maxRetries) {
        await Notification.findByIdAndUpdate(notifId, {
          status: 'failed',
          attempts: attempt,
          lastAttemptAt: new Date(),
          error: String(err),
        });
      } else {
        await sleep(2 ** attempt * 1000);
      }
    }
  }
};

export const sendEmail = async (to: string, subject: string, html: string, attachments?: any[]): Promise<void> => {
  const fromAddress = env.EMAIL_FROM || 'harshd2911@gmail.com';
  await transporter.sendMail({ from: fromAddress, to, subject, html, attachments });
};

const formatWhatsAppMobile = (mobile: string): string => {
  // Strip all non-digit characters
  let digits = mobile.replace(/\D/g, '');
  // Strip leading 00 if present
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }
  // Default to prefixing 91 (India) if it's a 10-digit number
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  return digits;
};

const sendSMS = async (mobile: string, message: string): Promise<void> => {
  if (!env.MSG91_AUTH_KEY) {
    logger.warn('SMS not configured, skipping');
    return;
  }
  const url = `https://api.msg91.com/api/v5/otp?template_id=&mobile=${mobile}&authkey=${env.MSG91_AUTH_KEY}&message=${encodeURIComponent(message)}`;
  await fetch(url);
};

const sendWhatsApp = async (mobile: string, message: string): Promise<void> => {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    logger.warn('WhatsApp (Twilio) not configured — skipping', { to: mobile, message });
    return;
  }

  const formattedMobile = formatWhatsAppMobile(mobile);
  const toNumber = `whatsapp:+${formattedMobile}`;

  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

  const msg = await client.messages.create({
    from: env.TWILIO_WHATSAPP_FROM,
    to: toNumber,
    body: message,           // plain-text dynamic message
  });

  logger.info(`WhatsApp sent via Twilio | SID: ${msg.sid} | to: ${toNumber}`);
};

const getEmailTemplate = (subject: string, message: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body {
          font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f8fafc;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          border-top: 4px solid #C99F0F; /* Specific Gold top border */
          overflow: hidden;
        }
        .header {
          background-color: #0D1A4B; /* Dark Blue */
          color: #C99F0F; /* Gold */
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #C99F0F !important; /* Force Gold text color */
        }
        .content {
          padding: 40px 32px;
          line-height: 1.7;
          color: #334155;
        }
        .content p {
          margin: 0 0 20px;
          font-size: 16px;
        }
        .footer {
          background-color: #0D1A4B; /* Dark Blue footer */
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #C99F0F; /* Gold footer text */
          border-top: 1px solid #1e2e6e;
        }
        .button {
          display: inline-block;
          background-color: #C99F0F; /* Gold Button */
          color: #0D1A4B; /* Dark Blue text */
          padding: 12px 28px;
          text-decoration: none;
          font-weight: 600;
          border-radius: 8px;
          margin-top: 20px;
          box-shadow: 0 4px 6px -1px rgba(201, 159, 15, 0.2);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nexcore Alliance</h1>
        </div>
        <div class="content">
          <p>${message.replace(/\n/g, '<br>')}</p>
        </div>
        <div class="footer">
          This is an automated notification. Please do not reply directly to this email.<br>
          &copy; ${new Date().getFullYear()} Nexcore Alliance. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
};

export interface NotifyPayload {
  recipientId: Types.ObjectId;
  recipientEmail?: string;
  recipientMobile?: string;
  subject?: string;
  message: string;
  ticketId?: Types.ObjectId;
}

export const notifyUser = async (payload: NotifyPayload): Promise<void> => {
  const { recipientId, recipientEmail, recipientMobile, subject, message, ticketId } = payload;

  const createAndSend = async (channel: string, fn: () => Promise<void>) => {
    const notif = await Notification.create({
      ticketId,
      recipient: recipientId,
      channel,
      subject,
      message,
    });
    await sendWithRetry(fn, notif.id);
  };

  const tasks: Promise<void>[] = [];

  if (recipientEmail) {
    const emailHtml = getEmailTemplate(subject || 'Ticket Notification', message);
    tasks.push(createAndSend('email', () => sendEmail(recipientEmail, subject || 'Nexcore Support', emailHtml)));
  }

  if (recipientMobile) {
    tasks.push(createAndSend('sms', () => sendSMS(recipientMobile, message)));
    tasks.push(createAndSend('whatsapp', () => sendWhatsApp(recipientMobile, message)));
  }

  sseManager.sendToUser(recipientId.toString(), 'notification', { message, ticketId });

  await Promise.allSettled(tasks);
};
