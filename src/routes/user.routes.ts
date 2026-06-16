import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import { listUsers, getUser, createUser, updateUser, listTechnicians } from '../controllers/user.controller.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authMiddleware);

router.get('/technicians', rbac(ROLES.ADMIN, ROLES.SUPERADMIN), listTechnicians);
router.get('/', rbac(ROLES.ADMIN, ROLES.SUPERADMIN), listUsers);
router.get('/:id', rbac(ROLES.ADMIN, ROLES.SUPERADMIN), getUser);
router.post('/', rbac(ROLES.SUPERADMIN), createUser);
router.patch('/:id', rbac(ROLES.SUPERADMIN), updateUser);

export default router;
