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
import { TICKET_STATUS, ROLES } from '../config/constants.js';
import { env } from '../config/env.js';

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await createTicket(req.user!.userId, req.body);
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

    if (
      req.user!.role === ROLES.CUSTOMER &&
      ticket.customerId.toString() !== req.user!.userId
    ) {
      throw new AppError('Forbidden', 403);
    }

    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, remarks } = req.body;
    const ticket = await updateTicketStatus(req.params.ticketId, status, req.user!.userId, remarks);
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

    if (assignedTechnician) {
      ticket.assignedTechnician = new Types.ObjectId(assignedTechnician);
      ticket.assignedAt = new Date();
    }
    if (assignedTeam) ticket.assignedTeam = assignedTeam;
    ticket.status = TICKET_STATUS.ASSIGNED;
    ticket.statusHistory.push({
      status: TICKET_STATUS.ASSIGNED,
      changedBy: new Types.ObjectId(req.user!.userId),
      timestamp: new Date(),
      remarks: `Assigned to ${assignedTeam || 'technician'}`,
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

    if (ticket.status !== TICKET_STATUS.CLOSED) {
      throw new AppError('Only closed tickets can be reopened', 422);
    }

    const daysSinceClosure = (Date.now() - (ticket.closedAt?.getTime() || 0)) / 86400000;
    if (daysSinceClosure > env.REOPEN_WINDOW_DAYS) {
      throw new AppError(`Reopen window of ${env.REOPEN_WINDOW_DAYS} days has passed`, 422);
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
