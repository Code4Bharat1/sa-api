import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import {
  create, list, getOne, updateStatus, assign,
  submitResolution, confirmResolution, reopen, submitFeedback,
  updatePriority, updateDeadline,
} from '../controllers/ticket.controller.js';
import {
  createTicketSchema, updateStatusSchema, assignTicketSchema,
  resolutionSchema, feedbackSchema, reopenSchema, ticketFilterSchema,
  updatePrioritySchema, updateDeadlineSchema,
} from '../validators/ticket.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authMiddleware);

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  const host = req.get('host');
  const protocol = req.protocol;
  const url = `${protocol}://${host}/uploads/${req.file.filename}`;
  res.json({ success: true, url });
});

router.get('/', validate(ticketFilterSchema, 'query'), list);
router.post('/', rbac(ROLES.CUSTOMER), validate(createTicketSchema), create);
router.get('/:ticketId', getOne);
router.patch('/:ticketId/status', rbac(ROLES.ADMIN, ROLES.TECHNICIAN), validate(updateStatusSchema), updateStatus);
router.patch('/:ticketId/assign', rbac(ROLES.ADMIN), validate(assignTicketSchema), assign);
router.patch('/:ticketId/priority', rbac(ROLES.ADMIN), validate(updatePrioritySchema), updatePriority);
router.patch('/:ticketId/deadline', rbac(ROLES.ADMIN), validate(updateDeadlineSchema), updateDeadline);
router.patch('/:ticketId/resolution', rbac(ROLES.TECHNICIAN, ROLES.ADMIN), validate(resolutionSchema), submitResolution);
router.post('/:ticketId/confirm', rbac(ROLES.CUSTOMER), confirmResolution);
router.post('/:ticketId/reopen', rbac(ROLES.CUSTOMER), validate(reopenSchema), reopen);
router.post('/:ticketId/feedback', rbac(ROLES.CUSTOMER), validate(feedbackSchema), submitFeedback);

export default router;
