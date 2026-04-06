// src/modules/records/record.controller.ts
import { Request, Response } from 'express';
import {
  createRecordSchema,
  updateRecordSchema,
  querySchema,
} from './record.validators';
import {
  createRecord,
  listRecords,
  getRecord,
  updateRecord,
  deleteRecord,
} from './record.service';
import { catchAsync } from '../../utils/catchAsync';
import { sendSuccess } from '../../utils/response';

export const recordController = {
  create: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const data = createRecordSchema.parse(req.body);
    const record = await createRecord({
      data,
      createdById: req.user!.id,
    });
    sendSuccess(res, record, 201);
  }),

  list: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const query = querySchema.parse(req.query);
    const result = await listRecords(query);
    sendSuccess(res, result.records, 200, result.meta);
  }),

  getById: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const record = await getRecord(req.params.id);
    sendSuccess(res, record);
  }),

  update: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const data = updateRecordSchema.parse(req.body);
    const record = await updateRecord({
      id: req.params.id,
      data,
      updatedById: req.user!.id,
    });
    sendSuccess(res, record);
  }),

  delete: catchAsync(async (req: Request, res: Response): Promise<void> => {
    await deleteRecord({
      id: req.params.id,
      deletedById: req.user!.id,
    });
    sendSuccess(res, { message: 'Record deleted successfully' });
  }),
};
