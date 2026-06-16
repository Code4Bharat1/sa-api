import ExcelJS from 'exceljs';
import { Ticket } from '../models/Ticket.js';
import { Types } from 'mongoose';

export const getKPIs = async () => {
  const [total, open, inProgress, resolved, closed, overdue] = await Promise.all([
    Ticket.countDocuments(),
    Ticket.countDocuments({ status: 'Open' }),
    Ticket.countDocuments({ status: 'In Progress' }),
    Ticket.countDocuments({ status: 'Resolved' }),
    Ticket.countDocuments({ status: 'Closed' }),
    Ticket.countDocuments({ isOverdue: true }),
  ]);

  const slaCompliant = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

  const avgRatingResult = await Ticket.aggregate([
    { $match: { 'feedback.rating': { $exists: true } } },
    { $group: { _id: null, avg: { $avg: '$feedback.rating' } } },
  ]);
  const avgRating = avgRatingResult[0]?.avg?.toFixed(1) || 'N/A';

  return { total, open, inProgress, resolved, closed, overdue, slaCompliant, avgRating };
};

export const getTechnicianPerformance = async () => {
  return Ticket.aggregate([
    { $match: { assignedTechnician: { $exists: true } } },
    {
      $group: {
        _id: '$assignedTechnician',
        totalAssigned: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } },
        avgRating: { $avg: '$feedback.rating' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'technician',
      },
    },
    { $unwind: '$technician' },
    {
      $project: {
        name: '$technician.name',
        email: '$technician.email',
        totalAssigned: 1,
        resolved: 1,
        avgRating: { $round: ['$avgRating', 1] },
        resolutionRate: {
          $multiply: [{ $divide: ['$resolved', '$totalAssigned'] }, 100],
        },
      },
    },
    { $sort: { resolved: -1 } },
  ]);
};

export const buildExcelReport = async (filters: Record<string, string>): Promise<ExcelJS.Buffer> => {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) (query.createdAt as Record<string, Date>)['$gte'] = new Date(filters.from);
    if (filters.to) (query.createdAt as Record<string, Date>)['$lte'] = new Date(filters.to);
  }

  const tickets = await Ticket.find(query)
    .populate('customerId', 'name email mobileNumber organizationName')
    .populate('assignedTechnician', 'name email')
    .lean();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tickets');

  sheet.columns = [
    { header: 'Ticket ID', key: 'ticketId', width: 20 },
    { header: 'Customer', key: 'customer', width: 25 },
    { header: 'Organization', key: 'org', width: 25 },
    { header: 'Panel Serial', key: 'serial', width: 20 },
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Priority', key: 'priority', width: 12 },
    { header: 'Status', key: 'status', width: 25 },
    { header: 'Technician', key: 'technician', width: 25 },
    { header: 'Created At', key: 'createdAt', width: 22 },
    { header: 'Closed At', key: 'closedAt', width: 22 },
    { header: 'Rating', key: 'rating', width: 10 },
  ];

  sheet.getRow(1).font = { bold: true };

  tickets.forEach((t) => {
    const customer = t.customerId as { name?: string; organizationName?: string } | null;
    const tech = t.assignedTechnician as { name?: string } | null;
    sheet.addRow({
      ticketId: t.ticketId,
      customer: customer?.name || '',
      org: customer?.organizationName || '',
      serial: t.panelSerialNumber,
      category: t.issueCategory,
      priority: t.priority,
      status: t.status,
      technician: tech?.name || '',
      createdAt: t.createdAt?.toISOString(),
      closedAt: t.closedAt?.toISOString() || '',
      rating: t.feedback?.rating || '',
    });
  });

  return workbook.xlsx.writeBuffer() as Promise<ExcelJS.Buffer>;
};
