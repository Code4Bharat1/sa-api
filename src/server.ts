import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { startSLAChecker } from './jobs/sla.job.js';
import { startAutoCloseJob } from './jobs/autoClose.job.js';

const bootstrap = async () => {
  await connectDB();

  startSLAChecker();
  startAutoCloseJob();

  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
};

bootstrap().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
