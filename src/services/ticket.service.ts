import { Types } from 'mongoose';
import { Ticket, ITicket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { TICKET_STATUS, VALID_TRANSITIONS, TicketStatus } from '../config/constants.js';
import { generateTicketId } from '../utils/counter.js';
import { computeExpectedTimes } from './sla.service.js';
import { notifyUser } from './notification.service.js';
import { sseManager } from '../sse/sseManager.js';
import { AppError } from '../middlewares/error.middleware.js';
import { workflowEngine } from './workflow.service.js';
import { logger } from '../utils/logger.js';

export const createTicket = async (
  customerId: string,
  data: {
    panelSerialNumber: string;
    issueCategory: ITicket['issueCategory'];
    description: string;
    priority?: ITicket['priority'];
    attachments?: string[];
  }
) => {
  const ticketId = await generateTicketId();
  const { expectedResponseTime, expectedResolutionTime } = computeExpectedTimes(data.issueCategory);

  const ticket = await Ticket.create({
    ticketId,
    customerId: new Types.ObjectId(customerId),
    panelSerialNumber: data.panelSerialNumber,
    issueCategory: data.issueCategory,
    description: data.description,
    priority: data.priority || 'medium',
    attachments: data.attachments || [],
    status: TICKET_STATUS.OPEN,
    statusHistory: [
      {
        status: TICKET_STATUS.OPEN,
        changedBy: new Types.ObjectId(customerId),
        timestamp: new Date(),
        remarks: 'Ticket created',
      },
    ],
    expectedResponseTime,
    expectedResolutionTime,
  });

  const customer = await User.findById(customerId);
  if (customer) {
    await notifyUser({
      recipientId: customer._id as Types.ObjectId,
      recipientEmail: customer.email,
      recipientMobile: customer.mobileNumber,
      subject: `Ticket ${ticketId} Created`,
      message: `Your support ticket ${ticketId} has been created. The expected response time is: ${expectedResponseTime.toLocaleString()}.`,
      ticketId: ticket._id as Types.ObjectId,
    });
  }

  sseManager.sendToRole('admin', 'ticket:new', { ticketId: ticket.ticketId });
  
  // Trigger future-ready workflows
  workflowEngine.emit('ticket:created', ticket).catch((err) => {
    logger.error('WorkflowEngine: ticket:created trigger failed', err);
  });

  return ticket;
};

export const updateTicketStatus = async (
  ticketId: string,
  newStatus: TicketStatus,
  actorId: string,
  remarks?: string,
  scheduledVisitDate?: string
) => {
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) throw new AppError('Ticket not found', 404);

  const allowed = VALID_TRANSITIONS[ticket.status as TicketStatus];
  if (!allowed?.includes(newStatus)) {
    throw new AppError(`Invalid transition from ${ticket.status} to ${newStatus}`, 422);
  }

  // Enrich the statusHistory remark with visit date when scheduling a visit
  let historyRemarks = remarks;
  if (newStatus === TICKET_STATUS.VISIT_SCHEDULED && scheduledVisitDate) {
    const formattedVisitDate = new Date(scheduledVisitDate).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    historyRemarks = remarks
      ? `${remarks} · Visit scheduled on ${formattedVisitDate}`
      : `Visit scheduled on ${formattedVisitDate}`;
  }

  const before = { status: ticket.status };
  ticket.statusHistory.push({
    status: newStatus,
    changedBy: new Types.ObjectId(actorId),
    timestamp: new Date(),
    remarks: historyRemarks,
  });
  ticket.status = newStatus;

  if (newStatus === TICKET_STATUS.VISIT_SCHEDULED && scheduledVisitDate) {
    ticket.scheduledVisitDate = new Date(scheduledVisitDate);
  } else if (before.status === TICKET_STATUS.VISIT_SCHEDULED && (newStatus === TICKET_STATUS.ASSIGNED || newStatus === TICKET_STATUS.ON_HOLD)) {
    ticket.scheduledVisitDate = undefined;
  }

  if (newStatus === TICKET_STATUS.CLOSED) ticket.closedAt = new Date();
  if (newStatus === TICKET_STATUS.REOPENED) {
    ticket.reopenStatus.isReopened = true;
    ticket.reopenStatus.reopenCount += 1;
  }

  await ticket.save();

  await AuditLog.create({
    actorId: new Types.ObjectId(actorId),
    action: 'STATUS_UPDATE',
    entity: 'Ticket',
    entityId: ticketId,
    before,
    after: { status: newStatus },
    timestamp: new Date(),
  });

  const customer = await User.findById(ticket.customerId);
  if (customer) {
    sseManager.sendToUser(ticket.customerId.toString(), 'ticket:status', {
      ticketId: ticket.ticketId,
      status: newStatus,
    });

    const remarksText = remarks ? ` Remarks: ${remarks}` : '';
    let message = `Your ticket ${ticket.ticketId} status changed to: ${newStatus}.${remarksText}`;

    const fromVisitScheduled = before.status === TICKET_STATUS.VISIT_SCHEDULED;
    // "Cancelled" only when visit is interrupted — not when work actually starts
    const isCancelled = fromVisitScheduled && (
      newStatus === TICKET_STATUS.ON_HOLD || newStatus === TICKET_STATUS.ASSIGNED
    );
    const isRescheduled = fromVisitScheduled && newStatus === TICKET_STATUS.VISIT_SCHEDULED;
    const visitStarted = fromVisitScheduled && newStatus === TICKET_STATUS.IN_PROGRESS;

    if (isRescheduled) {
      const formattedDate = ticket.scheduledVisitDate ? new Date(ticket.scheduledVisitDate).toLocaleString() : 'scheduled time';
      message = `The scheduled technician visit for your ticket ${ticket.ticketId} has been rescheduled to ${formattedDate}.${remarksText}`;
    } else if (visitStarted) {
      message = `The technician has arrived for your ticket ${ticket.ticketId} and work is now in progress.${remarksText}`;
    } else if (isCancelled) {
      message = `The scheduled technician visit for your ticket ${ticket.ticketId} has been cancelled.${remarksText}`;
    } else if (newStatus === TICKET_STATUS.VISIT_SCHEDULED) {
      const formattedDate = ticket.scheduledVisitDate ? new Date(ticket.scheduledVisitDate).toLocaleString() : 'scheduled time';
      message = `A technician visit has been scheduled for your ticket ${ticket.ticketId} on ${formattedDate}.${remarksText}`;
    } else if (newStatus === TICKET_STATUS.RESOLVED) {
      message = `Your ticket ${ticket.ticketId} has been marked as Resolved.${remarksText} Please log in to confirm the resolution. If the issue persists, you can reopen the ticket.`;
    } else if (newStatus === TICKET_STATUS.CLOSED) {
      message = `Your support ticket ${ticket.ticketId} has been successfully closed.${remarksText}`;
    }

    await notifyUser({
      recipientId: ticket.customerId as Types.ObjectId,
      recipientEmail: customer.email,
      recipientMobile: customer.mobileNumber,
      subject: `Ticket ${ticket.ticketId} Update`,
      message,
      ticketId: ticket._id as Types.ObjectId,
    });
  }

  // Trigger future-ready workflows
  workflowEngine.emit('ticket:status_changed', ticket, { before, newStatus }).catch((err) => {
    logger.error('WorkflowEngine: ticket:status_changed trigger failed', err);
  });

  return ticket;
};

export const getTickets = async (filters: Record<string, string>, userRole: string, userId: string) => {
  const query: Record<string, unknown> = {};

  if (userRole === 'customer') query.customerId = new Types.ObjectId(userId);
  if (userRole === 'technician') query.assignedTechnician = new Types.ObjectId(userId);

  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.issueCategory) query.issueCategory = filters.issueCategory;
  if (filters.panelSerialNumber) query.panelSerialNumber = filters.panelSerialNumber;
  // Only admins can filter by a specific technician — role-based filters above take precedence
  if (filters.assignedTechnician && userRole === 'admin') {
    query.assignedTechnician = new Types.ObjectId(filters.assignedTechnician);
  }

  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) (query.createdAt as Record<string, Date>)['$gte'] = new Date(filters.from);
    if (filters.to) (query.createdAt as Record<string, Date>)['$lte'] = new Date(filters.to);
  }

  if (filters.search) {
    query['$or'] = [
      { ticketId: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
    ];
  }

  let page = parseInt(filters.page || '1', 10);
  let limit = parseInt(filters.limit || '20', 10);
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: query },
    {
      $addFields: {
        isPendingUnassigned: {
          $cond: {
            if: {
              $and: [
                { $in: ['$status', ['Open', 'Under Review']] },
                { $or: [
                  { $eq: ['$assignedTechnician', null] },
                  { $not: ['$assignedTechnician'] }
                ]}
              ]
            },
            then: 0,
            else: 1
          }
        },
        priorityWeight: {
          $switch: {
            branches: [
              { case: { $eq: ['$priority', 'critical'] }, then: 4 },
              { case: { $eq: ['$priority', 'high'] }, then: 3 },
              { case: { $eq: ['$priority', 'medium'] }, then: 2 },
              { case: { $eq: ['$priority', 'low'] }, then: 1 }
            ],
            default: 0
          }
        }
      }
    },
    {
      $sort: {
        isPendingUnassigned: 1,
        priorityWeight: -1,
        createdAt: -1
      }
    },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'customerId',
        foreignField: '_id',
        as: 'customerId'
      }
    },
    { $unwind: { path: '$customerId', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'assignedTechnician',
        foreignField: '_id',
        as: 'assignedTechnician'
      }
    },
    { $unwind: { path: '$assignedTechnician', preserveNullAndEmptyArrays: true } }
  ];

  const [tickets, total] = await Promise.all([
    Ticket.aggregate(pipeline),
    Ticket.countDocuments(query),
  ]);

  return { tickets, total, page, limit, pages: Math.ceil(total / limit) };
};
