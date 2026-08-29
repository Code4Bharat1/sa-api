import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { AppError } from '../middlewares/error.middleware.js';
import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  createTicket,
  updateTicketStatus,
  getTickets,
} from '../services/ticket.service.js';
import { notifyUser } from '../services/notification.service.js';
import { sseManager } from '../sse/sseManager.js';
import { TICKET_STATUS, ROLES } from '../config/constants.js';
import { env } from '../config/env.js';

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = { ...req.body };
    if (req.user!.role === ROLES.CUSTOMER) {
      delete body.priority;
      delete body.customerId;
      delete body.customCustomerName;
      delete body.customOrganizationName;
      delete body.customCustomerEmail;
      delete body.customCustomerMobile;
      delete body.assignedTechnician;
    }
    const ticket = await createTicket(req.user!.userId, req.user!.role, body);
    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const list = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await getTickets(
      req.query as Record<string, string>,
      req.user!.role,
      req.user!.userId
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId })
      .populate('customerId', 'name email mobileNumber organizationName panels')
      .populate('assignedTechnician', 'name email mobileNumber')
      .populate('statusHistory.changedBy', 'name role');

    if (!ticket) throw new AppError('Ticket not found', 404);

    const customerIdStr = (ticket.customerId as any)._id
      ? (ticket.customerId as any)._id.toString()
      : ticket.customerId.toString();

    // Customers can only view their own tickets
    if (req.user!.role === ROLES.CUSTOMER && customerIdStr !== req.user!.userId) {
      throw new AppError('Forbidden', 403);
    }

    // Technicians can only view tickets assigned to them
    if (req.user!.role === ROLES.TECHNICIAN) {
      const assignedTechId = (ticket.assignedTechnician as any)?._id?.toString()
        ?? ticket.assignedTechnician?.toString();
      if (assignedTechId !== req.user!.userId) {
        throw new AppError('Forbidden', 403);
      }
    }

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, remarks, scheduledVisitDate } = req.body;
    const ticket = await updateTicketStatus(
      req.params.ticketId,
      status,
      req.user!.userId,
      remarks,
      scheduledVisitDate,
      req.user!.role
    );
    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const assign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { assignedTechnician, assignedTeam } = req.body;
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) throw new AppError('Ticket not found', 404);

    // Look up technician name so the timeline remark includes it
    let techName = assignedTeam || 'technician';
    if (assignedTechnician) {
      const techUser = await User.findById(assignedTechnician).lean();
      if (techUser) techName = techUser.name;
      ticket.assignedTechnician = new Types.ObjectId(assignedTechnician);
      ticket.assignedAt = new Date();
    }
    if (assignedTeam) ticket.assignedTeam = assignedTeam;
    ticket.status = TICKET_STATUS.ASSIGNED;
    ticket.statusHistory.push({
      status: TICKET_STATUS.ASSIGNED,
      changedBy: new Types.ObjectId(req.user!.userId),
      timestamp: new Date(),
      remarks: `Assigned to technician ${techName}`,
    });

    await ticket.save();

    await AuditLog.create({
      actorId: new Types.ObjectId(req.user!.userId),
      action: 'ASSIGN',
      entity: 'Ticket',
      entityId: ticket.ticketId,
      after: { assignedTechnician, assignedTeam },
      timestamp: new Date(),
    });

    if (assignedTechnician) {
      const tech = await User.findById(assignedTechnician);
      if (tech) {
        await notifyUser({
          recipientId: tech._id as Types.ObjectId,
          recipientEmail: tech.email,
          recipientMobile: tech.mobileNumber,
          subject: `Ticket ${ticket.ticketId} Assigned to You`,
          message: `Ticket ${ticket.ticketId} has been assigned to you. Please review and schedule a visit.`,
          ticketId: ticket._id as Types.ObjectId,
        });
      }
    }

    const customer = await User.findById(ticket.customerId);
    if (customer) {
      const tech = assignedTechnician ? await User.findById(assignedTechnician) : null;
      const techName = tech ? tech.name : (assignedTeam || 'a technician');
      await notifyUser({
        recipientId: customer._id as Types.ObjectId,
        recipientEmail: customer.email,
        recipientMobile: customer.mobileNumber,
        subject: `Ticket ${ticket.ticketId} Assigned`,
        message: `Your ticket ${ticket.ticketId} has been assigned to ${techName}.`,
        ticketId: ticket._id as Types.ObjectId,
      });
    }

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const submitResolution = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) throw new AppError('Ticket not found', 404);

    ticket.resolution = {
      workPerformed: req.body.workPerformed,
      partsUsed: req.body.partsUsed || [],
      images: req.body.images || [],
      customerSignature: req.body.customerSignature,
      remarks: req.body.remarks,
      resolvedAt: new Date(),
    };

    ticket.status = TICKET_STATUS.RESOLVED;
    ticket.statusHistory.push({
      status: TICKET_STATUS.RESOLVED,
      changedBy: new Types.ObjectId(req.user!.userId),
      timestamp: new Date(),
      remarks: 'Resolution submitted',
    });

    await ticket.save();

    const customer = await User.findById(ticket.customerId);
    if (customer) {
      await notifyUser({
        recipientId: ticket.customerId as Types.ObjectId,
        recipientEmail: customer.email,
        recipientMobile: customer.mobileNumber,
        subject: `Ticket ${ticket.ticketId} Resolved`,
        message: `Your ticket ${ticket.ticketId} has been resolved. Work performed: ${ticket.resolution.workPerformed}. Please log in to confirm the resolution.`,
        ticketId: ticket._id as Types.ObjectId,
      });
    }

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const confirmResolution = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) throw new AppError('Ticket not found', 404);

    if (ticket.customerId.toString() !== req.user!.userId) {
      throw new AppError('Only the ticket owner can confirm resolution', 403);
    }

    if (ticket.status !== TICKET_STATUS.CONFIRMATION_PENDING && ticket.status !== TICKET_STATUS.RESOLVED) {
      throw new AppError('Ticket is not pending confirmation', 422);
    }

    ticket.status = TICKET_STATUS.CLOSED;
    ticket.closedAt = new Date();
    ticket.statusHistory.push({
      status: TICKET_STATUS.CLOSED,
      changedBy: new Types.ObjectId(req.user!.userId),
      timestamp: new Date(),
      remarks: 'Customer confirmed resolution',
    });

    await ticket.save();

    // Notify customer that their ticket has been officially closed
    const customer = await User.findById(ticket.customerId);
    if (customer) {
      sseManager.sendToUser(customer._id.toString(), 'ticket:status', {
        ticketId: ticket.ticketId,
        status: TICKET_STATUS.CLOSED,
      });
      await notifyUser({
        recipientId: customer._id as Types.ObjectId,
        recipientEmail: customer.email,
        recipientMobile: customer.mobileNumber,
        subject: `Ticket ${ticket.ticketId} Closed`,
        message: `Your support ticket ${ticket.ticketId} has been officially closed. Thank you for confirming the resolution. We hope your issue was resolved to your satisfaction.`,
        ticketId: ticket._id as Types.ObjectId,
      });
    }

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const reopen = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) throw new AppError('Ticket not found', 404);

    if (ticket.customerId.toString() !== req.user!.userId) {
      throw new AppError('Only the ticket owner can reopen', 403);
    }

    const before = { status: ticket.status };

    if (
      ticket.status !== TICKET_STATUS.CLOSED &&
      ticket.status !== TICKET_STATUS.CONFIRMATION_PENDING &&
      ticket.status !== TICKET_STATUS.RESOLVED
    ) {
      throw new AppError('Ticket cannot be reopened from its current status', 422);
    }

    if (ticket.status === TICKET_STATUS.CLOSED) {
      const daysSinceClosure = (Date.now() - (ticket.closedAt?.getTime() || 0)) / 86400000;
      if (daysSinceClosure > env.REOPEN_WINDOW_DAYS) {
        throw new AppError(`Reopen window of ${env.REOPEN_WINDOW_DAYS} days has passed`, 422);
      }
    }

    ticket.status = TICKET_STATUS.REOPENED;
    ticket.reopenStatus.isReopened = true;
    ticket.reopenStatus.reopenCount += 1;
    ticket.reopenStatus.reasons.push({ reason: req.body.reason, reopenedAt: new Date() });
    ticket.statusHistory.push({
      status: TICKET_STATUS.REOPENED,
      changedBy: new Types.ObjectId(req.user!.userId),
      timestamp: new Date(),
      remarks: req.body.reason,
    });

    await ticket.save();

    await AuditLog.create({
      actorId: new Types.ObjectId(req.user!.userId),
      action: 'STATUS_UPDATE',
      entity: 'Ticket',
      entityId: ticket._id as Types.ObjectId,
      before,
      after: { status: TICKET_STATUS.REOPENED },
      timestamp: new Date(),
    });

    sseManager.sendToUser(ticket.customerId.toString(), 'ticket:status', {
      ticketId: ticket.ticketId,
      status: TICKET_STATUS.REOPENED,
    });

    sseManager.sendToRole('admin', 'ticket:status', {
      ticketId: ticket.ticketId,
      status: TICKET_STATUS.REOPENED,
    });

    const customer = await User.findById(ticket.customerId);
    if (customer) {
      await notifyUser({
        recipientId: customer._id as Types.ObjectId,
        recipientEmail: customer.email,
        recipientMobile: customer.mobileNumber,
        subject: `Ticket ${ticket.ticketId} Reopened`,
        message: `Your ticket ${ticket.ticketId} has been successfully reopened. Remarks: ${req.body.reason}`,
        ticketId: ticket._id as Types.ObjectId,
      });
    }

    if (ticket.assignedTechnician) {
      sseManager.sendToUser(ticket.assignedTechnician.toString(), 'ticket:status', {
        ticketId: ticket.ticketId,
        status: TICKET_STATUS.REOPENED,
      });
      const technician = await User.findById(ticket.assignedTechnician);
      if (technician) {
        await notifyUser({
          recipientId: technician._id as Types.ObjectId,
          recipientEmail: technician.email,
          recipientMobile: technician.mobileNumber,
          subject: `Ticket ${ticket.ticketId} Reopened`,
          message: `Ticket ${ticket.ticketId} assigned to you has been reopened by the customer. Remarks: ${req.body.reason}`,
          ticketId: ticket._id as Types.ObjectId,
        });
      }
    }

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const submitFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) throw new AppError('Ticket not found', 404);

    if (ticket.customerId.toString() !== req.user!.userId) {
      throw new AppError('Only the ticket owner can submit feedback', 403);
    }

    ticket.feedback = {
      rating: req.body.rating,
      comment: req.body.comment,
      submittedAt: new Date(),
    };

    await ticket.save();
    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const updatePriority = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { priority } = req.body;
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) throw new AppError('Ticket not found', 404);

    const before = { priority: ticket.priority };
    ticket.priority = priority;
    ticket.statusHistory.push({
      status: ticket.status,
      changedBy: new Types.ObjectId(req.user!.userId),
      timestamp: new Date(),
      remarks: `Priority updated from ${before.priority} to ${priority}`,
    });
    await ticket.save();

    await AuditLog.create({
      actorId: new Types.ObjectId(req.user!.userId),
      action: 'PRIORITY_UPDATE',
      entity: 'Ticket',
      entityId: ticket.ticketId,
      before,
      after: { priority },
      timestamp: new Date(),
    });

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const updateDeadline = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { resolutionDeadline } = req.body;
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) throw new AppError('Ticket not found', 404);

    const before = { resolutionDeadline: ticket.resolutionDeadline };
    ticket.resolutionDeadline = new Date(resolutionDeadline);
    ticket.statusHistory.push({
      status: ticket.status,
      changedBy: new Types.ObjectId(req.user!.userId),
      timestamp: new Date(),
      remarks: `Resolution deadline updated to ${ticket.resolutionDeadline.toLocaleString()}`,
    });
    await ticket.save();

    await AuditLog.create({
      actorId: new Types.ObjectId(req.user!.userId),
      action: 'DEADLINE_UPDATE',
      entity: 'Ticket',
      entityId: ticket.ticketId,
      before,
      after: { resolutionDeadline: ticket.resolutionDeadline },
      timestamp: new Date(),
    });

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};
