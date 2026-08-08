import { createServer } from 'http';
import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { startSLAChecker } from './jobs/sla.job.js';
import { startAutoCloseJob } from './jobs/autoClose.job.js';
import { initSocket } from './socket.js';

import * as dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const bootstrap = async () => {
  await connectDB();

  startSLAChecker();
  startAutoCloseJob();

  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}] with Socket.IO enabled`);
  });
};

bootstrap().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
