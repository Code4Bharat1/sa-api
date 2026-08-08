import { Router } from 'express';
import { getTicketMessages, postTicketMessage, getAdminChatThreads } from '../controllers/message.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/admin/threads', getAdminChatThreads);
router.get('/:ticketId', getTicketMessages);
router.post('/:ticketId', postTicketMessage);

export default router;
