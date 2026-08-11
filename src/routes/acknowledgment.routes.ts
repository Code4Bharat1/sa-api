import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import {
  createAcknowledgment,
  listAcknowledgments,
  getAcknowledgment,
} from '../controllers/acknowledgment.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createAcknowledgmentSchema } from '../validators/acknowledgment.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authMiddleware);

router.post('/', rbac(ROLES.TECHNICIAN, ROLES.ADMIN), validate(createAcknowledgmentSchema), createAcknowledgment);
router.get('/', rbac(ROLES.TECHNICIAN, ROLES.ADMIN), listAcknowledgments);
router.get('/:id', rbac(ROLES.TECHNICIAN, ROLES.ADMIN), getAcknowledgment);

export default router;
