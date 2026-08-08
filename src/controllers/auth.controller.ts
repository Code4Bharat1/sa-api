import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { generateCustomerId } from '../utils/counter.js';
import { createOTPRecord, validateOTPRecord, generateOTP } from '../utils/otp.js';
import { notifyUser } from '../services/notification.service.js';
import { AppError } from '../middlewares/error.middleware.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { env } from '../config/env.js';
import { Types } from 'mongoose';

const googleClient = new OAuth2Client();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, mobileNumber, email, password, organizationName, address, city, state, panels } = req.body;

    const exists = await User.findOne({ $or: [{ email }, { mobileNumber }] });
    if (exists) throw new AppError('Email or mobile already registered', 409);

    const customerId = await generateCustomerId();
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    const user = await User.create({
      customerId,
      name,
      mobileNumber,
      email,
      passwordHash,
      organizationName,
      address,
      city,
      state,
      panels: panels?.map((p: { serialNumber: string; size: string; installationDate: string }) => ({
        ...p,
        installationDate: new Date(p.installationDate),
      })) || [],
      role: 'customer',
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { customerId: user.customerId, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};

export const requestOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identifier } = req.body;
    const user = await User.findOne({
      $or: [{ mobileNumber: identifier }, { email: identifier }, { customerId: identifier }],
    });
    if (!user) throw new AppError('User not found', 404);

    const code = generateOTP();
    await createOTPRecord(identifier, code);

    await notifyUser({
      recipientId: user._id as Types.ObjectId,
      recipientEmail: user.email,
      recipientMobile: user.mobileNumber,
      subject: 'Your OTP',
      message: `Your IFPD login OTP is: ${code}. Valid for ${env.OTP_EXPIRY_MINUTES} minutes.`,
    });

    res.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    next(err);
  }
};

export const verifyOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identifier, code } = req.body;
    const valid = await validateOTPRecord(identifier, code);
    if (!valid) throw new AppError('Invalid or expired OTP', 400);

    const user = await User.findOne({
      $or: [{ mobileNumber: identifier }, { email: identifier }, { customerId: identifier }],
    });
    if (!user || !user.isActive) throw new AppError('Account not found or inactive', 404);

    const payload = { userId: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    user.refreshTokenHash = refreshHash;
    await user.save();

    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, customerId: user.customerId, profileComplete: user.profileComplete },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({
      $or: [{ email: identifier }, { customerId: identifier }, { mobileNumber: identifier }],
    });
    if (!user || !user.isActive) throw new AppError('Invalid credentials', 401);
    if (!user.passwordHash) throw new AppError('Please use OTP login', 400);

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new AppError('Invalid credentials', 401);

    const payload = { userId: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    user.refreshTokenHash = refreshHash;
    await user.save();

    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, customerId: user.customerId, profileComplete: user.profileComplete },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) throw new AppError('No refresh token', 401);

    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.userId);
    if (!user?.refreshTokenHash) throw new AppError('Invalid session', 401);

    const valid = await bcrypt.compare(token, user.refreshTokenHash);
    if (!valid) throw new AppError('Invalid refresh token', 401);

    const newPayload = { userId: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(newPayload);
    const newRefresh = signRefreshToken(newPayload);
    user.refreshTokenHash = await bcrypt.hash(newRefresh, 10);
    await user.save();

    res.cookie('refreshToken', newRefresh, COOKIE_OPTS);
    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user.userId, { refreshTokenHash: null });
    }
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user!.userId).select('-passwordHash -refreshTokenHash');
    if (!user) throw new AppError('User not found', 404);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credential } = req.body;
    if (!credential) throw new AppError('Google ID token is required', 400);

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID || undefined,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) throw new AppError('Invalid Google token payload', 400);

    const { email, name, sub: googleId } = payload;
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.isActive) throw new AppError('Account is inactive', 403);
    } else {
      const customerId = await generateCustomerId();
      user = new User({
        customerId,
        name: name || 'Google User',
        email: email.toLowerCase(),
        googleId,
        role: 'customer',
        profileComplete: false,
        panels: [],
      });
    }

    const tokenPayload = { userId: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const refreshTokenToken = signRefreshToken(tokenPayload);
    const refreshHash = await bcrypt.hash(refreshTokenToken, 10);
    user.refreshTokenHash = refreshHash;
    await user.save();

    res.cookie('refreshToken', refreshTokenToken, COOKIE_OPTS);
    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          customerId: user.customerId,
          mobileNumber: user.mobileNumber,
          profileComplete: user.profileComplete,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const completeProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);

    const { password, mobileNumber, organizationName, address, city, state, panels } = req.body;

    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    if (password) {
      if (password.length < 8) throw new AppError('Password must be at least 8 characters long', 400);
      user.passwordHash = await bcrypt.hash(password, 12);
    } else if (!user.passwordHash) {
      throw new AppError('Password is required to complete your profile', 400);
    }

    if (mobileNumber) {
      const existingMobile = await User.findOne({ mobileNumber, _id: { $ne: userId } });
      if (existingMobile) throw new AppError('Mobile number already registered by another account', 409);
      user.mobileNumber = mobileNumber;
    }

    if (organizationName !== undefined) user.organizationName = organizationName;
    if (address !== undefined) user.address = address;
    if (city !== undefined) user.city = city;
    if (state !== undefined) user.state = state;
    if (!panels || !Array.isArray(panels) || panels.length === 0) {
      throw new AppError('At least one IFPD panel is required', 400);
    }
    user.panels = panels.map((p: { serialNumber: string; size: string; installationDate: string }) => ({
      ...p,
      installationDate: new Date(p.installationDate),
    }));

    user.profileComplete = true;
    await user.save();

    const sanitizedUser = await User.findById(userId).select('-passwordHash -refreshTokenHash');

    res.json({
      success: true,
      message: 'Profile completed successfully',
      data: sanitizedUser,
    });
  } catch (err) {
    next(err);
  }
};
