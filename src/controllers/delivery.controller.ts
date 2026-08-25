import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { AppError } from '../middlewares/error.middleware.js';
import { Delivery, DeliveryStatus } from '../models/Delivery.js';
import {
  sendDualDeliveryWhatsApp,
  sendDualDeliveryUpdateWhatsApp,
} from '../services/whatsapp.service.js';
import { logger } from '../utils/logger.js';

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createDelivery = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      address,
      googleMapLink,
      productName,
      deliveryAgentName,
      deliveryAgentPhone,
      deliveryAgentEmail,
      deliveryDate,
      estimateTime,
      status,
    } = req.body;

    if (
      !customerName ||
      !customerEmail ||
      !customerPhone ||
      !address ||
      !productName ||
      !deliveryAgentName ||
      !deliveryAgentPhone ||
      !deliveryAgentEmail ||
      !deliveryDate ||
      !estimateTime
    ) {
      throw new AppError('All required delivery fields must be filled', 400);
    }

    const delivery = await Delivery.create({
      adminId: req.user!.userId,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      address: address.trim(),
      googleMapLink: googleMapLink ? googleMapLink.trim() : undefined,
      productName: productName.trim(),
      deliveryAgentName: deliveryAgentName.trim(),
      deliveryAgentPhone: deliveryAgentPhone.trim(),
      deliveryAgentEmail: deliveryAgentEmail.trim(),
      deliveryDate: deliveryDate.trim(),
      estimateTime: estimateTime.trim(),
      status: status || 'Scheduled',
    });

    // Send dual WhatsApp messages asynchronously (don't block HTTP response)
    sendDualDeliveryWhatsApp(delivery).catch((err) => {
      logger.error('Error dispatching dual delivery WhatsApp messages', err);
    });

    res.status(201).json({
      success: true,
      message: 'Delivery record created and WhatsApp messages dispatched to customer and delivery agent',
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDelivery = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      customerEmail,
      customerPhone,
      address,
      googleMapLink,
      productName,
      deliveryAgentName,
      deliveryAgentPhone,
      deliveryAgentEmail,
      deliveryDate,
      estimateTime,
      status,
    } = req.body;

    const delivery = await Delivery.findByIdAndUpdate(
      id,
      {
        customerName: customerName ? customerName.trim() : undefined,
        customerEmail: customerEmail ? customerEmail.trim() : undefined,
        customerPhone: customerPhone ? customerPhone.trim() : undefined,
        address: address ? address.trim() : undefined,
        googleMapLink: googleMapLink !== undefined ? (googleMapLink ? googleMapLink.trim() : '') : undefined,
        productName: productName ? productName.trim() : undefined,
        deliveryAgentName: deliveryAgentName ? deliveryAgentName.trim() : undefined,
        deliveryAgentPhone: deliveryAgentPhone ? deliveryAgentPhone.trim() : undefined,
        deliveryAgentEmail: deliveryAgentEmail ? deliveryAgentEmail.trim() : undefined,
        deliveryDate: deliveryDate ? deliveryDate.trim() : undefined,
        estimateTime: estimateTime ? estimateTime.trim() : undefined,
        status: status || undefined,
      },
      { new: true, runValidators: true }
    ).populate('adminId', 'name email');

    if (!delivery) {
      throw new AppError('Delivery record not found', 404);
    }

    // Send updated WhatsApp messages to both Customer and Agent
    sendDualDeliveryUpdateWhatsApp(delivery).catch((err) => {
      logger.error('Error dispatching updated delivery WhatsApp messages', err);
    });

    res.status(200).json({
      success: true,
      message: 'Delivery record updated and revised WhatsApp notifications dispatched',
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

export const getDeliveries = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, status } = req.query;
    const filter: Record<string, any> = {};

    if (status && typeof status === 'string' && status !== 'All') {
      filter.status = status;
    }

    if (search && typeof search === 'string') {
      const q = escapeRegex(search.trim());
      filter.$or = [
        { customerName: { $regex: q, $options: 'i' } },
        { customerEmail: { $regex: q, $options: 'i' } },
        { customerPhone: { $regex: q, $options: 'i' } },
        { productName: { $regex: q, $options: 'i' } },
        { deliveryAgentName: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } },
      ];
    }

    const deliveries = await Delivery.find(filter)
      .populate('adminId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: deliveries.length,
      data: deliveries,
    });
  } catch (error) {
    next(error);
  }
};

export const getDeliveryById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const delivery = await Delivery.findById(id).populate('adminId', 'name email');

    if (!delivery) {
      throw new AppError('Delivery record not found', 404);
    }

    res.status(200).json({
      success: true,
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses: DeliveryStatus[] = ['Scheduled', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const delivery = await Delivery.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).populate('adminId', 'name email');

    if (!delivery) {
      throw new AppError('Delivery record not found', 404);
    }

    // Trigger updated status WhatsApp messages to customer and agent
    sendDualDeliveryWhatsApp(delivery).catch((err) => {
      logger.error('Error dispatching updated status WhatsApp messages', err);
    });

    res.status(200).json({
      success: true,
      message: `Delivery status updated to ${status} and WhatsApp notifications sent`,
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

export const resendDeliveryWhatsApp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const delivery = await Delivery.findById(id);

    if (!delivery) {
      throw new AppError('Delivery record not found', 404);
    }

    await sendDualDeliveryWhatsApp(delivery);

    res.status(200).json({
      success: true,
      message: 'WhatsApp notifications resent to customer and delivery agent',
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDelivery = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const delivery = await Delivery.findByIdAndDelete(id);

    if (!delivery) {
      throw new AppError('Delivery record not found', 404);
    }

    res.status(200).json({
      success: true,
      message: 'Delivery record deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
