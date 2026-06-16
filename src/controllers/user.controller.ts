import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { AppError } from '../middlewares/error.middleware.js';
import { ROLES, Role } from '../config/constants.js';
import { generateCustomerId } from '../utils/counter.js';
import { AuditLog } from '../models/AuditLog.js';
import { Types } from 'mongoose';

export const listUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role, isActive, search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const query: Record<string, unknown> = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query['$or'] = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [users, total] = await Promise.all([
      User.find(query).select('-passwordHash -refreshTokenHash').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
      User.countDocuments(query),
    ]);

    res.json({ success: true, data: users, total, page: parseInt(page, 10), pages: Math.ceil(total / parseInt(limit, 10)) });
  } catch (err) {
    next(err);
  }
};

export const getUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash -refreshTokenHash');
    if (!user) throw new AppError('User not found', 404);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, mobileNumber, email, password, role, organizationName, address, city, state } = req.body;

    const exists = await User.findOne({ $or: [{ email }, { mobileNumber }] });
    if (exists) throw new AppError('Email or mobile already exists', 409);

    const customerId = await generateCustomerId();
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    const user = await User.create({ customerId, name, mobileNumber, email, passwordHash, role, organizationName, address, city, state });

    await AuditLog.create({
      actorId: new Types.ObjectId(req.user!.userId),
      action: 'CREATE_USER',
      entity: 'User',
      entityId: user.id,
      after: { name, email, role },
      timestamp: new Date(),
    });

    res.status(201).json({ success: true, data: { id: user.id, customerId: user.customerId, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { isActive, role, name, organizationName } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('User not found', 404);

    if (req.user!.role === ROLES.ADMIN) {
      if (user.role === ROLES.ADMIN || user.role === ROLES.SUPERADMIN) {
        throw new AppError('Admins cannot modify Admin or Super Admin accounts', 403);
      }
    }

    const before = { isActive: user.isActive, role: user.role, name: user.name };
    if (isActive !== undefined) {
      if (req.user!.userId === user.id && isActive === false) {
        throw new AppError('You cannot deactivate your own account', 400);
      }
      user.isActive = isActive;
    }
    if (role) {
      if (req.user!.role === ROLES.ADMIN && (role === ROLES.ADMIN || role === ROLES.SUPERADMIN)) {
        throw new AppError('Admins cannot assign Admin or Super Admin roles', 403);
      }
      user.role = role as Role;
    }
    if (name) user.name = name;
    if (organizationName) user.organizationName = organizationName;

    await user.save();

    await AuditLog.create({
      actorId: new Types.ObjectId(req.user!.userId),
      action: 'UPDATE_USER',
      entity: 'User',
      entityId: user.id,
      before,
      after: { isActive: user.isActive, role: user.role, name: user.name },
      timestamp: new Date(),
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const listTechnicians = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const technicians = await User.find({ role: ROLES.TECHNICIAN, isActive: true }).select('name email mobileNumber');
    res.json({ success: true, data: technicians });
  } catch (err) {
    next(err);
  }
};
