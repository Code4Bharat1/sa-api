import 'dotenv/config';

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI:
    process.env.MONGODB_URI ||
    'mongodb://sa_service:nexcorealliance@72.62.241.150:27037/admin?authSource=admin',

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'access_secret_dev',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'refresh_secret_dev',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  SMS_PROVIDER: process.env.SMS_PROVIDER || 'msg91',
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY || '',
  MSG91_SENDER_ID: process.env.MSG91_SENDER_ID || 'IFPD',

  // WhatsApp via Twilio (sandbox until Meta API is ready)
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
  TWILIO_CONTENT_SID: process.env.TWILIO_CONTENT_SID || '',

  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'support@studentalliance.in',

  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_BUCKET: process.env.S3_BUCKET || 'ifpd-uploads',
  S3_REGION: process.env.S3_REGION || 'ap-south-1',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || '',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || '',

  SLA_DEFAULT_RESPONSE_HOURS: parseInt(process.env.SLA_DEFAULT_RESPONSE_HOURS || '4', 10),
  SLA_DEFAULT_RESOLUTION_HOURS: parseInt(process.env.SLA_DEFAULT_RESOLUTION_HOURS || '48', 10),
  AUTO_CLOSE_DAYS: parseInt(process.env.AUTO_CLOSE_DAYS || '3', 10),
  REOPEN_WINDOW_DAYS: parseInt(process.env.REOPEN_WINDOW_DAYS || '7', 10),
};
