import mongoose from 'mongoose';
import { env } from './config/env.js';
import { Notification } from './models/Notification.js';

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected!');

  const notifs = await Notification.find({ channel: 'whatsapp' }).sort({ createdAt: -1 }).limit(10);
  console.log('Recent WhatsApp notifications:');
  console.log(JSON.stringify(notifs, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
