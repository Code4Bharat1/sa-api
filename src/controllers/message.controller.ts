import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { TicketMessage } from '../models/TicketMessage.js';
import { Ticket } from '../models/Ticket.js';
import { AppError } from '../middlewares/error.middleware.js';
import { Types } from 'mongoose';
import { getIO } from '../socket.js';
import { decryptText } from '../utils/crypto.js';

export const getTicketMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) throw new AppError('Ticket not found', 404);

    // Permission check: customer can only view their own ticket chat
    if (req.user?.role === 'customer' && ticket.customerId.toString() !== req.user.userId) {
      throw new AppError('Forbidden access to ticket chat', 403);
    }

    const messages = await TicketMessage.find({ ticketId }).sort({ createdAt: 1 });

    // Mark unread messages as read by current user
    const userIdObj = new Types.ObjectId(req.user!.userId);
    await TicketMessage.updateMany(
      { ticketId, readBy: { $ne: userIdObj } },
      { $addToSet: { readBy: userIdObj } }
    );

    res.json({
      success: true,
      data: messages,
    });
  } catch (err) {
    next(err);
  }
};

export const postTicketMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const { message, attachments, replyTo } = req.body;

    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) throw new AppError('Ticket not found', 404);

    if (req.user?.role === 'customer' && ticket.customerId.toString() !== req.user.userId) {
      throw new AppError('Forbidden access to ticket chat', 403);
    }

    if (!message?.trim() && (!attachments || attachments.length === 0)) {
      throw new AppError('Message or attachment is required', 400);
    }

    const newMsg = await TicketMessage.create({
      ticketId,
      senderId: new Types.ObjectId(req.user!.userId),
      senderRole: req.user!.role,
      senderName: req.user!.email || 'User',
      message: message?.trim() || '',
      attachments: attachments || [],
      replyTo: replyTo || undefined,
      readBy: [new Types.ObjectId(req.user!.userId)],
    });

    try {
      getIO().to(`ticket_${ticketId}`).emit('new_message', newMsg.toJSON());
    } catch (e) {
      // Socket emission fallback ignored
    }

    res.status(201).json({
      success: true,
      data: newMsg,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminChatThreads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new AppError('Forbidden', 403);
    }

    // Aggregate latest message per ticketId
    const conversations = await TicketMessage.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$ticketId',
          lastMessage: { $first: '$message' },
          lastSenderRole: { $first: '$senderRole' },
          lastSenderName: { $first: '$senderName' },
          updatedAt: { $first: '$createdAt' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$senderRole', 'customer'] },
                  { $not: [{ $in: [new Types.ObjectId(req.user!.userId), '$readBy'] }] }
                ]},
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { updatedAt: -1 } }
    ]);

    // Populate ticket info for each conversation thread
    const ticketIds = conversations.map((c) => c._id);
    const tickets = await Ticket.find({ ticketId: { $in: ticketIds } })
      .populate('customerId', 'name email mobileNumber')
      .select('ticketId customerId panelSerialNumber issueCategory status priority createdAt');

    const ticketMap = new Map(tickets.map((t) => [t.ticketId, t]));

    const threads = conversations.map((c) => ({
      ticketId: c._id,
      ticket: ticketMap.get(c._id) || null,
      lastMessage: decryptText(c.lastMessage),
      lastSenderRole: c.lastSenderRole,
      lastSenderName: c.lastSenderName,
      updatedAt: c.updatedAt,
      unreadCount: c.unreadCount,
    }));

    res.json({
      success: true,
      data: threads,
    });
  } catch (err) {
    next(err);
  }
};
