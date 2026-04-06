// src/modules/users/user.controller.ts
import { Request, Response } from 'express';
import { listUsersQuerySchema, updateUserSchema } from './user.validators';
import { listUsers, getUser, updateUser, deactivateUser } from './user.service';
import { catchAsync } from '../../utils/catchAsync';
import { sendSuccess } from '../../utils/response';

export const userController = {
  list: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const query = listUsersQuerySchema.parse(req.query);
    const result = await listUsers(query);
    sendSuccess(res, result.users, 200, result.meta);
  }),

  getById: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const user = await getUser(req.params.id);
    sendSuccess(res, user);
  }),

  update: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const data = updateUserSchema.parse(req.body);
    const updated = await updateUser({
      currentUserId: req.user!.id,
      targetUserId: req.params.id,
      data,
    });
    sendSuccess(res, updated);
  }),

  deactivate: catchAsync(async (req: Request, res: Response): Promise<void> => {
    await deactivateUser({
      currentUserId: req.user!.id,
      targetUserId: req.params.id,
    });
    sendSuccess(res, { message: 'User deactivated successfully' });
  }),
};
