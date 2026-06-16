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
      message: `Your support ticket ${ticketId} has been created. We will respond within the SLA window.`,
      ticketId: ticket._id as Types.ObjectId,
    });
  }

  sseManager.sendToRole('admin', 'ticket:new', { ticketId: ticket.ticketId });

  return ticket;
};

export const updateTicketStatus = async (
  ticketId: string,
  newStatus: TicketStatus,
  actorId: string,
  remarks?: string
) => {
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) throw new AppError('Ticket not found', 404);

  const allowed = VALID_TRANSITIONS[ticket.status as TicketStatus];
  if (!allowed?.includes(newStatus)) {
    throw new AppError(`Invalid transition from ${ticket.status} to ${newStatus}`, 422);
  }

  const before = { status: ticket.status };
  ticket.statusHistory.push({
    status: newStatus,
    changedBy: new Types.ObjectId(actorId),
    timestamp: new Date(),
    remarks,
  });
  ticket.status = newStatus;

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
    await notifyUser({
      recipientId: ticket.customerId as Types.ObjectId,
      recipientEmail: customer.email,
      recipientMobile: customer.mobileNumber,
      subject: `Ticket ${ticket.ticketId} Updated`,
      message: `Your ticket ${ticket.ticketId} status changed to: ${newStatus}. ${remarks || ''}`,
      ticketId: ticket._id as Types.ObjectId,
    });
  }

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
  if (filters.assignedTechnician) query.assignedTechnician = new Types.ObjectId(filters.assignedTechnician);

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

  const page = parseInt(filters.page || '1', 10);
  const limit = parseInt(filters.limit || '20', 10);
  const skip = (page - 1) * limit;

  const [tickets, total] = await Promise.all([
    Ticket.find(query)
      .populate('customerId', 'name email mobileNumber organizationName')
      .populate('assignedTechnician', 'name email mobileNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Ticket.countDocuments(query),
  ]);

  return { tickets, total, page, limit, pages: Math.ceil(total / limit) };
};
