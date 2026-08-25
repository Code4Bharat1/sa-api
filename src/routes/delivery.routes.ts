import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import {
  createDelivery,
  updateDelivery,
  getDeliveries,
  getDeliveryById,
  updateDeliveryStatus,
  resendDeliveryWhatsApp,
  deleteDelivery,
} from '../controllers/delivery.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createDeliverySchema,
  updateDeliveryStatusSchema,
} from '../validators/delivery.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authMiddleware);
router.use(rbac(ROLES.ADMIN));

router.post('/', validate(createDeliverySchema), createDelivery);
router.put('/:id', validate(createDeliverySchema), updateDelivery);
router.get('/', getDeliveries);
router.get('/:id', getDeliveryById);
router.patch('/:id/status', validate(updateDeliveryStatusSchema), updateDeliveryStatus);
router.post('/:id/resend-whatsapp', resendDeliveryWhatsApp);
router.delete('/:id', deleteDelivery);

export default router;
