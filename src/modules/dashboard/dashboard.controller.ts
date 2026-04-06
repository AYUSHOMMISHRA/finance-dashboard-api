// src/modules/dashboard/dashboard.controller.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { getSummary, getByCategory, getTrends, getRecent } from './dashboard.service';
import { catchAsync } from '../../utils/catchAsync';
import { sendSuccess } from '../../utils/response';

const trendsQuerySchema = z.object({
  granularity: z.enum(['monthly', 'weekly']).default('monthly'),
});

export const dashboardController = {
  getSummary: catchAsync(async (_req: Request, res: Response): Promise<void> => {
    const summary = await getSummary();
    sendSuccess(res, summary);
  }),

  getByCategory: catchAsync(async (_req: Request, res: Response): Promise<void> => {
    const data = await getByCategory();
    sendSuccess(res, data);
  }),

  getTrends: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const query = trendsQuerySchema.parse(req.query);
    const data = await getTrends(query.granularity);
    sendSuccess(res, data);
  }),

  getRecent: catchAsync(async (_req: Request, res: Response): Promise<void> => {
    const data = await getRecent();
    sendSuccess(res, data);
  }),
};
