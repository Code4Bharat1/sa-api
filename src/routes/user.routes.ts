import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import { listUsers, getUser, createUser, updateUser, listTechnicians } from '../controllers/user.controller.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authMiddleware);

router.get('/technicians', rbac(ROLES.ADMIN), listTechnicians);
router.get('/', rbac(ROLES.ADMIN), listUsers);
router.get('/:id', rbac(ROLES.ADMIN), getUser);
router.post('/', rbac(ROLES.ADMIN), createUser);
router.patch('/:id', rbac(ROLES.ADMIN), updateUser);

export default router;
