import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { AppError } from '../middlewares/error.middleware.js';
import { PanelInventory } from '../models/PanelInventory.js';
import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = new Types.ObjectId(req.user!.userId);
    const body = req.body;
    const cleanSerial = body.panelSerialNumber.trim().toUpperCase();

    // Case-insensitive duplicate serial number check
    const escapedSerial = cleanSerial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await PanelInventory.findOne({
      panelSerialNumber: { $regex: new RegExp(`^${escapedSerial}$`, 'i') },
    });
    if (existing) {
      throw new AppError(`Panel serial number "${cleanSerial}" is already registered in inventory`, 409);
    }

    const item = await PanelInventory.create({
      ...body,
      adminId,
      panelSerialNumber: cleanSerial,
    });

    await AuditLog.create({
      actorId: adminId,
      action: 'CREATE',
      entity: 'PanelInventory',
      entityId: item._id.toString(),
      after: item.toObject(),
      timestamp: new Date(),
    });

    logger.info(`Panel inventory record created: ${item.panelSerialNumber}`);
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    if (err?.code === 11000) {
      return next(new AppError(`Panel serial number "${req.body?.panelSerialNumber || 'specified'}" is already registered in inventory`, 409));
    }
    next(err);
  }
};

export const list = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25', 10)));
    const skip = (page - 1) * limit;
    const search = ((req.query.search as string) || '').trim();

    const query: any = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { panelSerialNumber: regex },
        { vendorName: regex },
        { customerName: regex },
        { customerOrganization: regex },
        { panelBrand: regex },
        { purchaseInvoiceNo: regex },
        { saleInvoiceNo: regex },
        { customerPhone: regex },
        { vendorPhone: regex },
        { customerEmail: regex },
        { vendorEmail: regex },
      ];
    }

    const [items, total, distinctVendors, distinctCustomers] = await Promise.all([
      PanelInventory.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PanelInventory.countDocuments(query),
      PanelInventory.distinct('vendorName', query),
      PanelInventory.distinct('customerName', query),
    ]);

    res.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalVendors: distinctVendors.length,
        totalCustomers: distinctCustomers.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      throw new AppError('Invalid panel inventory record ID', 400);
    }

    const item = await PanelInventory.findById(req.params.id);
    if (!item) {
      throw new AppError('Panel inventory record not found', 404);
    }
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      throw new AppError('Invalid panel inventory record ID', 400);
    }

    const item = await PanelInventory.findById(req.params.id);
    if (!item) {
      throw new AppError('Panel inventory record not found', 404);
    }

    // Check duplicate serial number if serial number changed (case-insensitive)
    if (req.body.panelSerialNumber && req.body.panelSerialNumber.trim().toUpperCase() !== item.panelSerialNumber) {
      const cleanSerial = req.body.panelSerialNumber.trim().toUpperCase();
      const escapedSerial = cleanSerial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await PanelInventory.findOne({
        panelSerialNumber: { $regex: new RegExp(`^${escapedSerial}$`, 'i') },
        _id: { $ne: item._id },
      });
      if (existing) {
        throw new AppError(`Panel serial number "${cleanSerial}" is already registered to another record`, 409);
      }
    }

    const before = item.toObject();
    Object.assign(item, req.body);
    if (req.body.panelSerialNumber) {
      item.panelSerialNumber = req.body.panelSerialNumber.trim().toUpperCase();
    }
    await item.save();

    await AuditLog.create({
      actorId: new Types.ObjectId(req.user!.userId),
      action: 'UPDATE',
      entity: 'PanelInventory',
      entityId: item._id.toString(),
      before,
      after: item.toObject(),
      timestamp: new Date(),
    });

    res.json({ success: true, data: item });
  } catch (err: any) {
    if (err?.code === 11000) {
      return next(new AppError('Panel serial number is already registered to another record', 409));
    }
    next(err);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      throw new AppError('Invalid panel inventory record ID', 400);
    }

    const item = await PanelInventory.findByIdAndDelete(req.params.id);
    if (!item) {
      throw new AppError('Panel inventory record not found', 404);
    }

    await AuditLog.create({
      actorId: new Types.ObjectId(req.user!.userId),
      action: 'DELETE',
      entity: 'PanelInventory',
      entityId: item._id.toString(),
      before: item.toObject(),
      timestamp: new Date(),
    });

    res.json({ success: true, message: 'Panel inventory record deleted successfully' });
  } catch (err) {
    next(err);
  }
};
