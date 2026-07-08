import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('MongoDB connected successfully');

    // Run role consolidation migration
    const db = mongoose.connection.db;
    if (db) {
      const result = await db.collection('users').updateMany(
        { role: 'superadmin' },
        { $set: { role: 'admin' } }
      );
      if (result.modifiedCount > 0) {
        logger.info(`Role Migration: Converted ${result.modifiedCount} superadmin users to admin`);
      }
    }
  } catch (err) {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  }
};
