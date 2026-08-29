import { Types } from 'mongoose';
import { Ticket, ITicket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { TICKET_STATUS, VALID_TRANSITIONS, TicketStatus, ROLES } from '../config/constants.js';
import { generateTicketId, generateCustomerId } from '../utils/counter.js';
import { computeExpectedTimes } from './sla.service.js';
import { notifyUser } from './notification.service.js';
import { sseManager } from '../sse/sseManager.js';
import { AppError } from '../middlewares/error.middleware.js';
import { workflowEngine } from './workflow.service.js';
import { logger } from '../utils/logger.js';

export const createTicket = async (
  actorId: string,
  actorRole: string,
  data: {
    panelSerialNumber: string;
    issueCategory: ITicket['issueCategory'];
    description: string;
    priority?: ITicket['priority'];
    attachments?: string[];
    customerId?: string;
    customCustomerName?: string;
    customOrganizationName?: string;
    customCustomerEmail?: string;
    customCustomerMobile?: string;
    assignedTechnician?: string;
  }
) => {
  let targetCustomerId = actorId;

  if (actorRole === ROLES.ADMIN) {
    if (data.customerId) {
      targetCustomerId = data.customerId;
    } else if (data.customCustomerName && data.customCustomerName.trim()) {
      // Find or create customer
      let existingCustomer = null;
      if (data.customCustomerEmail && data.customCustomerEmail.trim()) {
        existingCustomer = await User.findOne({
          email: data.customCustomerEmail.trim().toLowerCase(),
        });
      }
      if (!existingCustomer && data.customCustomerMobile && data.customCustomerMobile.trim()) {
        existingCustomer = await User.findOne({
          mobileNumber: data.customCustomerMobile.trim(),
        });
      }

      if (existingCustomer) {
        targetCustomerId = existingCustomer._id.toString();
        if (!existingCustomer.organizationName && data.customOrganizationName) {
          existingCustomer.organizationName = data.customOrganizationName.trim();
          await existingCustomer.save();
        }
      } else {
        const newCustomerId = await generateCustomerId();
        const fallbackEmail = data.customCustomerEmail?.trim().toLowerCase()
          || `cust_${Date.now()}@studentalliancellp.com`;

        const createdCustomer = await User.create({
          customerId: newCustomerId,
          name: data.customCustomerName.trim(),
          organizationName: data.customOrganizationName?.trim() || 'Direct Client',
          email: fallbackEmail,
          mobileNumber: data.customCustomerMobile?.trim() || undefined,
          role: ROLES.CUSTOMER,
          profileComplete: true,
          isActive: true,
          panels: data.panelSerialNumber ? [
            {
              serialNumber: data.panelSerialNumber.trim(),
              size: 'Standard',
              installationDate: new Date(),
            }
          ] : [],
        });
        targetCustomerId = createdCustomer._id.toString();
      }
    }
  }

  const ticketId = await generateTicketId();
  const { expectedResponseTime, expectedResolutionTime } = computeExpectedTimes(data.issueCategory);

  const initialStatus = data.assignedTechnician ? TICKET_STATUS.ASSIGNED : TICKET_STATUS.OPEN;
  const initialRemarks = data.assignedTechnician
    ? 'Ticket created and assigned to technician'
    : 'Ticket created';

  const ticketDocData: any = {
    ticketId,
    customerId: new Types.ObjectId(targetCustomerId),
    panelSerialNumber: data.panelSerialNumber,
    issueCategory: data.issueCategory,
    description: data.description,
    priority: data.priority || 'medium',
    attachments: data.attachments || [],
    status: initialStatus,
    statusHistory: [
      {
        status: initialStatus,
        changedBy: new Types.ObjectId(actorId),
        timestamp: new Date(),
        remarks: initialRemarks,
      },
    ],
    expectedResponseTime,
    expectedResolutionTime,
  };

  if (data.assignedTechnician) {
    ticketDocData.assignedTechnician = new Types.ObjectId(data.assignedTechnician);
    ticketDocData.assignedAt = new Date();
  }

  const ticket = await Ticket.create(ticketDocData);

  const customer = await User.findById(targetCustomerId);
  if (customer && customer.email) {
    await notifyUser({
      recipientId: customer._id as Types.ObjectId,
      recipientEmail: customer.email,
      recipientMobile: customer.mobileNumber,
      subject: `Support Ticket ${ticketId} Created`,
      message: `Dear ${customer.name},\n\nYour support ticket ${ticketId} has been successfully registered.\n\nIssue Category: ${data.issueCategory}\nPriority: ${(data.priority || 'medium').toUpperCase()}\nPanel Serial: ${data.panelSerialNumber}\nDescription: ${data.description}\nExpected Response Time: ${expectedResponseTime.toLocaleString()}.\n\nOur team is working on resolving your issue as quickly as possible.`,
      ticketId: ticket._id as Types.ObjectId,
    });
  }

  if (data.assignedTechnician) {
    const techUser = await User.findById(data.assignedTechnician);
    if (techUser && techUser.email) {
      await notifyUser({
        recipientId: techUser._id as Types.ObjectId,
        recipientEmail: techUser.email,
        recipientMobile: techUser.mobileNumber,
        subject: `New Ticket Assigned: ${ticketId}`,
        message: `Hello ${techUser.name},\n\nYou have been assigned to Ticket ${ticketId}.\n\nCustomer: ${customer?.name || 'Customer'}\nOrganization: ${customer?.organizationName || 'N/A'}\nCategory: ${data.issueCategory}\nPriority: ${(data.priority || 'medium').toUpperCase()}\nPanel Serial: ${data.panelSerialNumber}\nDescription: ${data.description}.`,
        ticketId: ticket._id as Types.ObjectId,
      });
    }
  }

  sseManager.sendToRole('admin', 'ticket:new', { ticketId: ticket.ticketId });
  if (data.assignedTechnician) {
    sseManager.sendToUser(data.assignedTechnician, 'ticket:assigned', { ticketId: ticket.ticketId });
  }

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
  scheduledVisitDate?: string,
  actorRole?: string
) => {
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) throw new AppError('Ticket not found', 404);

  const isAdminClosing = (actorRole === ROLES.ADMIN) && (newStatus === TICKET_STATUS.CLOSED);

  if (!isAdminClosing) {
    const allowed = VALID_TRANSITIONS[ticket.status as TicketStatus];
    if (!allowed?.includes(newStatus)) {
      throw new AppError(`Invalid transition from ${ticket.status} to ${newStatus}`, 422);
    }
  } else if (ticket.status === TICKET_STATUS.CLOSED) {
    throw new AppError('Ticket is already closed', 422);
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
  } else if (isAdminClosing && !remarks) {
    historyRemarks = 'Closed by administrator';
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
                {
                  $or: [
                    { $eq: ['$assignedTechnician', null] },
                    { $not: ['$assignedTechnician'] }
                  ]
                }
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
