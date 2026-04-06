// src/modules/records/record.service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prismaClient';
import { AppError } from '../../utils/AppError';
import { AUDIT_ACTIONS } from '../../constants/auditActions';
import {
  serializeRecord,
  serializeRecords,
  serializeForMeta,
  SerializedRecord,
} from '../../utils/serializers';
import { PaginationMeta } from '../../utils/response';
import { CreateRecordInput, UpdateRecordInput, ListRecordsQuery } from './record.validators';

interface CreateRecordContext {
  data: CreateRecordInput;
  createdById: string;
}

export async function createRecord(ctx: CreateRecordContext): Promise<SerializedRecord> {
  const { data, createdById } = ctx;

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.financialRecord.create({
      data: {
        amount: new Prisma.Decimal(data.amount),
        type: data.type,
        category: data.category,
        date: new Date(data.date),
        notes: data.notes,
        createdById,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: createdById,
        action: AUDIT_ACTIONS.RECORD_CREATE,
        entity: 'FinancialRecord',
        entityId: created.id,
        meta: serializeForMeta(created),
      },
    });

    return created;
  });

  return serializeRecord(record);
}

interface ListRecordsResponse {
  records: SerializedRecord[];
  meta: PaginationMeta;
}

export async function listRecords(query: ListRecordsQuery): Promise<ListRecordsResponse> {
  const { type, category, startDate, endDate, search, page, limit, sortBy, order } = query;

  // Dynamic where construction
  const where: Prisma.FinancialRecordWhereInput = {
    isDeleted: false, // ALWAYS present — non-negotiable
    ...(type && { type }),
    ...(category && {
      category: { contains: category, mode: 'insensitive' },
    }),
    ...((startDate || endDate) && {
      date: {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      },
    }),
    ...(search && {
      OR: [
        { notes: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [records, total] = await prisma.$transaction([
    prisma.financialRecord.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: order },
    }),
    prisma.financialRecord.count({ where }),
  ]);

  return {
    records: serializeRecords(records),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getRecord(id: string): Promise<SerializedRecord> {
  const record = await prisma.financialRecord.findFirst({
    where: { id, isDeleted: false },
  });

  if (!record) {
    throw AppError.notFound('Record');
  }

  return serializeRecord(record);
}

interface UpdateRecordContext {
  id: string;
  data: UpdateRecordInput;
  updatedById: string;
}

export async function updateRecord(ctx: UpdateRecordContext): Promise<SerializedRecord> {
  const { id, data, updatedById } = ctx;

  // Fetch first
  const existing = await prisma.financialRecord.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw AppError.notFound('Record');
  }

  // Capture old values with serializeForMeta BEFORE update
  const oldValues = serializeForMeta(existing);

  // Build updateData with explicit type conversions
  const updateData: Prisma.FinancialRecordUpdateInput = {
    ...(data.amount !== undefined && {
      amount: new Prisma.Decimal(data.amount),
      // MUST convert JS number to Prisma.Decimal
      // Passing raw number to Decimal field = type mismatch error
    }),
    ...(data.date && {
      date: new Date(data.date),
      // MUST convert ISO string to Date object
      // Passing raw string to DateTime field = type mismatch error
    }),
    ...(data.type !== undefined && { type: data.type }),
    ...(data.category !== undefined && {
      category: data.category.trim(),
    }),
    ...(data.notes !== undefined && {
      notes: data.notes === null ? null : data.notes.trim(),
      // handles both clearing (null) and updating (string)
    }),
  };

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.financialRecord.update({
      where: { id },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        userId: updatedById,
        action: AUDIT_ACTIONS.RECORD_UPDATE,
        entity: 'FinancialRecord',
        entityId: id,
        meta: {
          before: oldValues,
          after: serializeForMeta(record),
        },
      },
    });

    return record;
  });

  return serializeRecord(updated);
}

interface DeleteRecordContext {
  id: string;
  deletedById: string;
}

export async function deleteRecord(ctx: DeleteRecordContext): Promise<void> {
  const { id, deletedById } = ctx;

  // Fetch first
  const record = await prisma.financialRecord.findUnique({
    where: { id },
  });

  if (!record || record.isDeleted) {
    throw AppError.notFound('Record');
  }
  // Double-delete = 404. Deleted records are non-existent to clients.

  await prisma.$transaction([
    prisma.financialRecord.update({
      where: { id },
      data: { isDeleted: true },
    }),
    prisma.auditLog.create({
      data: {
        userId: deletedById,
        action: AUDIT_ACTIONS.RECORD_DELETE,
        entity: 'FinancialRecord',
        entityId: id,
        meta: serializeForMeta(record),
      },
    }),
  ]);
}
