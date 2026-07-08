import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import { kpis, ticketReport, technicianPerformance, auditLogs } from '../controllers/report.controller.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authMiddleware, rbac(ROLES.ADMIN));

router.get('/dashboard/kpis', kpis);
router.get('/tickets', ticketReport);
router.get('/technician-performance', technicianPerformance);
router.get('/audit-logs', rbac(ROLES.ADMIN), auditLogs);

export default router;
