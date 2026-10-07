import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { rbac } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  create,
  list,
  getOne,
  update,
  remove,
} from '../controllers/inventory.controller.js';
import {
  createInventorySchema,
  updateInventorySchema,
  inventoryFilterSchema,
} from '../validators/inventory.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Only Admins can manage Panel Inventory & Sales
router.use(authMiddleware);
router.use(rbac(ROLES.ADMIN));

router.get('/', validate(inventoryFilterSchema, 'query'), list);
router.post('/', validate(createInventorySchema), create);
router.get('/:id', getOne);
router.put('/:id', validate(updateInventorySchema), update);
router.delete('/:id', remove);

export default router;
