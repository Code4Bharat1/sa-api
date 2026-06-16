import cron from 'node-cron';
import { Ticket } from '../models/Ticket.js';
import { TICKET_STATUS } from '../config/constants.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const startAutoCloseJob = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - env.AUTO_CLOSE_DAYS * 24 * 3600 * 1000);
      const tickets = await Ticket.find({
        status: { $in: [TICKET_STATUS.CONFIRMATION_PENDING, TICKET_STATUS.RESOLVED] },
        updatedAt: { $lt: cutoff },
      });

      for (const ticket of tickets) {
        ticket.status = TICKET_STATUS.CLOSED;
        ticket.closedAt = new Date();
        ticket.statusHistory.push({
          status: TICKET_STATUS.CLOSED,
          changedBy: ticket.customerId,
          timestamp: new Date(),
          remarks: 'Auto-closed: no customer response within window',
        });
        await ticket.save();
      }

      if (tickets.length > 0) {
        logger.info(`Auto-close job: closed ${tickets.length} tickets`);
      }
    } catch (err) {
      logger.error('Auto-close job error', err);
    }
  });

  logger.info('Auto-close cron started');
};
