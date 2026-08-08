import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken, JwtPayload } from './utils/jwt.js';
import { TicketMessage } from './models/TicketMessage.js';
import { User } from './models/User.js';
import { Types } from 'mongoose';

export interface AuthenticatedSocket extends Socket {
  user?: JwtPayload & { name?: string };
}

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication Middleware for Sockets
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication token required'));
      }
      const payload = verifyAccessToken(token);
      const userDoc = await User.findById(payload.userId).select('name');
      socket.user = {
        ...payload,
        name: userDoc?.name || 'User',
      };
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) return;

    // Join a specific ticket chat room
    socket.on('join_ticket', (ticketId: string) => {
      if (!ticketId) return;
      const roomName = `ticket_${ticketId}`;
      socket.join(roomName);
    });

    // Leave a specific ticket chat room
    socket.on('leave_ticket', (ticketId: string) => {
      if (!ticketId) return;
      socket.leave(`ticket_${ticketId}`);
    });

    // Handle sending message
    socket.on(
      'send_message',
      async (data: {
        ticketId: string;
        message: string;
        attachments?: string[];
        replyTo?: {
          messageId: string;
          senderName: string;
          senderRole: 'customer' | 'admin' | 'technician';
          message: string;
        };
      }) => {
        try {
          const { ticketId, message, attachments, replyTo } = data;
          if (!ticketId || (!message?.trim() && (!attachments || attachments.length === 0))) return;

          const newMsg = await TicketMessage.create({
            ticketId,
            senderId: new Types.ObjectId(user.userId),
            senderRole: user.role,
            senderName: user.name || 'User',
            message: message?.trim() || '',
            attachments: attachments || [],
            replyTo: replyTo || undefined,
            readBy: [new Types.ObjectId(user.userId)],
          });

        // Broadcast to ticket room (toJSON() triggers getters for decryption)
        io?.to(`ticket_${ticketId}`).emit('new_message', newMsg.toJSON());
      } catch (err) {
        socket.emit('error_message', { message: 'Failed to send message' });
      }
    });

    // Handle typing status
    socket.on('typing', (data: { ticketId: string; isTyping: boolean }) => {
      if (!data.ticketId) return;
      socket.to(`ticket_${data.ticketId}`).emit('user_typing', {
        userId: user.userId,
        senderName: user.name,
        isTyping: data.isTyping,
      });
    });

    // Mark messages as read
    socket.on('mark_read', async (ticketId: string) => {
      if (!ticketId) return;
      try {
        await TicketMessage.updateMany(
          { ticketId, readBy: { $ne: new Types.ObjectId(user.userId) } },
          { $addToSet: { readBy: new Types.ObjectId(user.userId) } }
        );
        io?.to(`ticket_${ticketId}`).emit('messages_read', { ticketId, userId: user.userId });
      } catch (err) {
        // Silent catch for socket error
      }
    });

    socket.on('disconnect', () => {
      // Socket disconnected
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io is not initialized');
  }
  return io;
};
