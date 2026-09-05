import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import {
  createAcknowledgment,
  listAcknowledgments,
  getAcknowledgment,
  updateAcknowledgmentDate,
} from '../controllers/acknowledgment.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createAcknowledgmentSchema,
  updateAcknowledgmentDateSchema,
} from '../validators/acknowledgment.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authMiddleware);

router.post('/', rbac(ROLES.ADMIN), validate(createAcknowledgmentSchema), createAcknowledgment);
router.get('/', rbac(ROLES.ADMIN), listAcknowledgments);
router.get('/:id', rbac(ROLES.ADMIN), getAcknowledgment);
router.patch('/:id/date', rbac(ROLES.ADMIN), validate(updateAcknowledgmentDateSchema), updateAcknowledgmentDate);

export default router;
