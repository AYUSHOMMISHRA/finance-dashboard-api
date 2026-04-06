// src/modules/records/record.validators.ts
import { z } from 'zod';

export const createRecordSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be positive')
    .refine(
      (v) => Number.isFinite(v) && Math.floor(v * 100) === v * 100,
      'Amount must have at most 2 decimal places'
    ),
  // NEVER use .multipleOf(0.01) — IEEE 754 float representation
  // causes 9.99, 0.01, 99.99 to incorrectly fail this check.
  // This refine is the correct approach.
  type: z.enum(['INCOME', 'EXPENSE']),
  category: z.string().trim().min(1).max(50),
  // .trim() prevents "salary" vs "salary " stored as
  // different categories, silently breaking groupBy
  date: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid date')
    .refine((d) => new Date(d) <= new Date(), 'Cannot be future'),
  notes: z.string().trim().max(500).optional(),
});

export const updateRecordSchema = z
  .object({
    amount: z
      .number()
      .positive('Amount must be positive')
      .refine(
        (v) => Number.isFinite(v) && Math.floor(v * 100) === v * 100,
        'Amount must have at most 2 decimal places'
      )
      .optional(),
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    category: z.string().trim().min(1).max(50).optional(),
    date: z
      .string()
      .refine((d) => !isNaN(Date.parse(d)), 'Invalid date')
      .refine((d) => new Date(d) <= new Date(), 'Cannot be future')
      .optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    // .nullable() allows { notes: null } to clear field.
    // Without nullable(), clearing notes returns 400.
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field',
  });

export const querySchema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    category: z.string().trim().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    sortBy: z.enum(['date', 'amount', 'createdAt']).default('date'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'startDate must be before or equal to endDate',
      path: ['startDate'],
    }
  );

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
export type ListRecordsQuery = z.infer<typeof querySchema>;
