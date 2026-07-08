import { ITicket } from '../models/Ticket.js';
import { logger } from '../utils/logger.js';

export type WorkflowEvent = 'ticket:created' | 'ticket:assigned' | 'ticket:status_changed' | 'ticket:deadline_approaching';
export type WorkflowHandler = (ticket: ITicket, context?: any) => Promise<void> | void;

class WorkflowEngine {
  private handlers: Map<WorkflowEvent, Set<WorkflowHandler>> = new Map();

  constructor() {
    // Initialize default registry
    this.registerDefaults();
  }

  /**
   * Register a custom listener hook for future automations
   */
  public on(event: WorkflowEvent, handler: WorkflowHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    logger.info(`WorkflowEngine: Registered custom handler for event "${event}"`);
  }

  /**
   * Emit an event to trigger registered automated workflows
   */
  public async emit(event: WorkflowEvent, ticket: ITicket, context?: any): Promise<void> {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers || eventHandlers.size === 0) return;

    logger.info(`WorkflowEngine: Emitting "${event}" for ticket ${ticket.ticketId}`);
    
    const tasks: Promise<void>[] = [];
    for (const handler of eventHandlers) {
      try {
        const result = handler(ticket, context);
        if (result instanceof Promise) {
          tasks.push(result);
        }
      } catch (err) {
        logger.error(`WorkflowEngine: Handler for "${event}" failed`, err);
      }
    }
    
    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  }

  private registerDefaults() {
    // Future extension point 1: Auto Ticket Assignment Escalation
    this.on('ticket:created', async (ticket) => {
      logger.info(`[Escalation System Hook] New ticket ${ticket.ticketId} created. Ready for auto-routing rules.`);
    });

    // Future extension point 2: SLA Proactive Reminder
    this.on('ticket:deadline_approaching', async (ticket) => {
      logger.info(`[SLA Escalation Hook] Ticket ${ticket.ticketId} is nearing its deadline! Preparing auto-escalation alert.`);
    });
  }
}

export const workflowEngine = new WorkflowEngine();
