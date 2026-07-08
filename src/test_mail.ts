import nodemailer from 'nodemailer';
import { env } from './config/env.js';

async function testMail() {
  console.log('Using SMTP configuration:');
  console.log('Host:', env.SMTP_HOST);
  console.log('Port:', env.SMTP_PORT);
  console.log('User:', env.SMTP_USER);
  console.log('Pass:', env.SMTP_PASS ? '******' : '(empty)');
  console.log('From:', env.EMAIL_FROM);

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  try {
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('✔ SMTP Connection verified successfully!');

    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to: 'harshd2911@gmail.com',
      subject: 'Nexcore SA Support: Test Email',
      text: 'This is a diagnostic test email to verify SMTP configuration.',
    });
    console.log('✔ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (error) {
    console.error('✘ SMTP Diagnostic failed:');
    console.error(error);
  }
}

testMail().catch(console.error);
