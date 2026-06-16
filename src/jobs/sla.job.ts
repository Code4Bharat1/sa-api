import cron from 'node-cron';
import { Ticket } from '../models/Ticket.js';
import { TICKET_STATUS } from '../config/constants.js';
import { sseManager } from '../sse/sseManager.js';
import { logger } from '../utils/logger.js';

export const startSLAChecker = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date();
      const result = await Ticket.updateMany(
        {
          status: { $nin: [TICKET_STATUS.CLOSED, TICKET_STATUS.RESOLVED] },
          expectedResponseTime: { $lt: now },
          isOverdue: false,
        },
        { $set: { isOverdue: true } }
      );

      if (result.modifiedCount > 0) {
        logger.info(`SLA checker: flagged ${result.modifiedCount} overdue tickets`);
        sseManager.sendToRole('admin', 'sla:overdue', { count: result.modifiedCount });
      }
    } catch (err) {
      logger.error('SLA checker error', err);
    }
  });

  logger.info('SLA checker cron started');
};
