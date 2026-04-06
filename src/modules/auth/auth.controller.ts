// src/modules/auth/auth.controller.ts
import { Request, Response } from 'express';
import { loginSchema, registerSchema } from './auth.validators';
import { login, register, getMe } from './auth.service';
import { catchAsync } from '../../utils/catchAsync';
import { sendSuccess } from '../../utils/response';

export const authController = {
  login: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const data = loginSchema.parse(req.body);
    const result = await login(data.email, data.password);
    sendSuccess(res, result);
  }),

  register: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const data = registerSchema.parse(req.body);
    const result = await register(data);
    sendSuccess(res, result, 201);
  }),

  getMe: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const user = await getMe(req.user!.id);
    sendSuccess(res, { user });
  }),
};
