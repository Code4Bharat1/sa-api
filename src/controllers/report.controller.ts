import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { getKPIs, getTechnicianPerformance, buildExcelReport } from '../services/report.service.js';
import { AuditLog } from '../models/AuditLog.js';

export const kpis = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getKPIs();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const ticketReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'json';

    if (format === 'xlsx') {
      const buffer = await buildExcelReport(req.query as Record<string, string>);
      res.setHeader('Content-Disposition', 'attachment; filename=tickets.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } else {
      const { Ticket } = await import('../models/Ticket.js');
      const query: Record<string, unknown> = {};
      const filters = req.query as Record<string, string>;
      if (filters.status) query.status = filters.status;
      if (filters.from || filters.to) {
        query.createdAt = {};
        if (filters.from) (query.createdAt as Record<string, Date>)['$gte'] = new Date(filters.from);
        if (filters.to) (query.createdAt as Record<string, Date>)['$lte'] = new Date(filters.to);
      }
      const tickets = await Ticket.find(query)
        .populate('customerId', 'name email')
        .populate('assignedTechnician', 'name')
        .lean();
      res.json({ success: true, data: tickets });
    }
  } catch (err) {
    next(err);
  }
};

export const technicianPerformance = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getTechnicianPerformance();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const auditLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { entity, page = '1', limit = '50' } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (entity) query.entity = entity;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [logs, total] = await Promise.all([
      AuditLog.find(query).populate('actorId', 'name role').sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit, 10)),
      AuditLog.countDocuments(query),
    ]);
    res.json({ success: true, data: logs, total });
  } catch (err) {
    next(err);
  }
};
