import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { AppError } from '../middlewares/error.middleware.js';
import { Delivery, DeliveryStatus } from '../models/Delivery.js';
import {
  sendDualDeliveryWhatsApp,
  sendDualDeliveryUpdateWhatsApp,
} from '../services/whatsapp.service.js';
import { sendEmail } from '../services/notification.service.js';
import { logger } from '../utils/logger.js';

const escapeHtml = (str: string) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const sendDeliveryEmail = async (delivery: any, isUpdate = false) => {
  try {
    const customerSubject = `${isUpdate ? 'Updated: ' : ''}Product Delivery Scheduled - ${delivery.productName}`;
    const html = `
      <!DOCTYPE html>
      <html lang="en" xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>${customerSubject}</title>
        <style type="text/css">
          body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
          table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
          img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
          body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          * { box-sizing: border-box; }
          
          @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; margin: 0 auto !important; border-radius: 0 !important; }
            .content-cell { padding: 24px 16px !important; }
            .header-cell { padding: 24px 16px !important; }
            .stat-cell { display: block !important; width: 100% !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 20px 0; background-color: #f1f5f9;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding: 10px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
                
                <!-- Header -->
                <tr>
                  <td class="header-cell" style="background: linear-gradient(135deg, #0D1A4B 0%, #172A68 100%); padding: 32px 28px; text-align: center; border-bottom: 4px solid #C99F0F;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #C99F0F;">NEXCORE ALLIANCE</h1>
                    <p style="margin: 6px 0 0 0; font-size: 13px; font-weight: 500; letter-spacing: 0.5px; color: #e2e8f0;">${isUpdate ? 'Delivery Schedule Update' : 'Official Delivery Notification'}</p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td class="content-cell" style="padding: 32px 28px; color: #334155;">
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5; color: #0f172a;">
                      Dear <strong>${escapeHtml(delivery.customerName)}</strong>,
                    </p>
                    <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #475569;">
                      ${isUpdate ? `Your product delivery details have been updated. Current status: <strong style="color: #0D1A4B;">${delivery.status}</strong>.` : `Your product delivery has been scheduled. Please find the delivery schedule and agent details below:`}
                    </p>

                    <!-- Details Box -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; overflow: hidden;">
                      <tr>
                        <td style="padding: 16px 20px; border-bottom: 1px solid #edf2f7;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px;">Product</div>
                          <div style="font-size: 15px; font-weight: 700; color: #0D1A4B;">${escapeHtml(delivery.productName)}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 20px; border-bottom: 1px solid #edf2f7;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px;">Delivery Schedule</div>
                          <div style="font-size: 14px; font-weight: 600; color: #1e293b;">📅 ${escapeHtml(delivery.deliveryDate)} · ⏰ ${escapeHtml(delivery.estimateTime)}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 20px; border-bottom: 1px solid #edf2f7;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px;">Delivery Address</div>
                          <div style="font-size: 13px; font-weight: 500; color: #334155; line-height: 1.5;">${escapeHtml(delivery.address)}</div>
                          ${delivery.googleMapLink ? `<div style="margin-top: 6px;"><a href="${delivery.googleMapLink}" target="_blank" style="color: #2563eb; text-decoration: underline; font-size: 12px; font-weight: 600;">📍 Open Location in Google Maps</a></div>` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 20px; border-bottom: 1px solid #edf2f7;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px;">Delivery Agent Details</div>
                          <div style="font-size: 14px; font-weight: 600; color: #1e293b;">👤 ${escapeHtml(delivery.deliveryAgentName)}</div>
                          <div style="font-size: 13px; color: #475569; margin-top: 2px;">📞 <a href="tel:${delivery.deliveryAgentPhone}" style="color: #0D1A4B; text-decoration: none; font-weight: 600;">${delivery.deliveryAgentPhone}</a> · ✉️ ${escapeHtml(delivery.deliveryAgentEmail)}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 20px;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 3px;">Delivery Status</div>
                          <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; background-color: #0D1A4B; color: #C99F0F;">${delivery.status}</div>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #0D1A4B; padding: 22px 20px; text-align: center; border-top: 1px solid #1e2e6e;">
                    <p style="margin: 0; font-size: 12px; font-weight: 500; color: #C99F0F;">
                      &copy; ${new Date().getFullYear()} Nexcore Alliance / Student Alliance LLP. All rights reserved.
                    </p>
                    <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                      For any questions regarding your delivery, please contact your delivery agent directly.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    if (delivery.customerEmail) {
      await sendEmail(delivery.customerEmail, customerSubject, html);
    }
  } catch (err) {
    logger.error('Error dispatching delivery email notification', err);
  }
};

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

    // Send responsive delivery email notification
    sendDeliveryEmail(delivery, false).catch((err) => {
      logger.error('Error dispatching delivery email', err);
    });

    res.status(201).json({
      success: true,
      message: 'Delivery record created and notifications dispatched to customer and delivery agent',
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

    // Send updated responsive email notification
    sendDeliveryEmail(delivery, true).catch((err) => {
      logger.error('Error dispatching updated delivery email', err);
    });

    res.status(200).json({
      success: true,
      message: 'Delivery record updated and revised notifications dispatched',
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

    // Send updated responsive email notification
    sendDeliveryEmail(delivery, true).catch((err) => {
      logger.error('Error dispatching updated status delivery email', err);
    });

    res.status(200).json({
      success: true,
      message: `Delivery status updated to ${status} and notifications dispatched`,
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
