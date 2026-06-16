import { Response } from 'express';
import { logger } from '../utils/logger.js';

interface SSEClient {
  userId: string;
  role: string;
  res: Response;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(userId: string, role: string, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    this.clients.set(userId, { userId, role, res });
    logger.debug(`SSE client connected: ${userId}`);

    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connected' })}\n\n`);

    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      res.write(': heartbeat\n\n');
    }, 30000);

    res.on('close', () => {
      clearInterval(heartbeat);
      this.clients.delete(userId);
      logger.debug(`SSE client disconnected: ${userId}`);
    });
  }

  sendToUser(userId: string, event: string, data: unknown): void {
    const client = this.clients.get(userId);
    if (client && !client.res.writableEnded) {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  sendToRole(role: string, event: string, data: unknown): void {
    this.clients.forEach((client) => {
      if (client.role === role && !client.res.writableEnded) {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  broadcast(event: string, data: unknown): void {
    this.clients.forEach((client) => {
      if (!client.res.writableEnded) {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  getConnectedCount(): number {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
