import nodemailer from 'nodemailer';
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

const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
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
  if (!env.WHATSAPP_TOKEN) {
    logger.warn('WhatsApp not configured, skipping');
    return;
  }
  await fetch(`https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'text',
      text: { body: message },
    }),
  });
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
    tasks.push(createAndSend('email', () => sendEmail(recipientEmail, subject || 'IFPD Support', `<p>${message}</p>`)));
  }

  if (recipientMobile) {
    tasks.push(createAndSend('sms', () => sendSMS(recipientMobile, message)));
    tasks.push(createAndSend('whatsapp', () => sendWhatsApp(recipientMobile, message)));
  }

  sseManager.sendToUser(recipientId.toString(), 'notification', { message, ticketId });

  await Promise.allSettled(tasks);
};
