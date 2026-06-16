import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  create, list, getOne, updateStatus, assign,
  submitResolution, confirmResolution, reopen, submitFeedback,
} from '../controllers/ticket.controller.js';
import {
  createTicketSchema, updateStatusSchema, assignTicketSchema,
  resolutionSchema, feedbackSchema, reopenSchema, ticketFilterSchema,
} from '../validators/ticket.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authMiddleware);

router.get('/', validate(ticketFilterSchema, 'query'), list);
router.post('/', rbac(ROLES.CUSTOMER), validate(createTicketSchema), create);
router.get('/:ticketId', getOne);
router.patch('/:ticketId/status', rbac(ROLES.ADMIN, ROLES.TECHNICIAN, ROLES.SUPERADMIN), validate(updateStatusSchema), updateStatus);
router.patch('/:ticketId/assign', rbac(ROLES.ADMIN, ROLES.SUPERADMIN), validate(assignTicketSchema), assign);
router.patch('/:ticketId/resolution', rbac(ROLES.TECHNICIAN, ROLES.ADMIN), validate(resolutionSchema), submitResolution);
router.post('/:ticketId/confirm', rbac(ROLES.CUSTOMER), confirmResolution);
router.post('/:ticketId/reopen', rbac(ROLES.CUSTOMER), validate(reopenSchema), reopen);
router.post('/:ticketId/feedback', rbac(ROLES.CUSTOMER), validate(feedbackSchema), submitFeedback);

export default router;
