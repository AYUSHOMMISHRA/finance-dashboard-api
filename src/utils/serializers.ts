// src/utils/serializers.ts
import { FinancialRecord } from '@prisma/client';

export interface SerializedRecord {
  id: string;
  amount: string;
  type: string;
  category: string;
  date: string;
  notes: string | null;
  isDeleted: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export const serializeRecord = (record: FinancialRecord): SerializedRecord => {
  return {
    ...record,
    amount: record.amount.toFixed(2),
    date: record.date.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
};

export const serializeRecords = (
  records: FinancialRecord[]
): SerializedRecord[] => {
  return records.map(serializeRecord);
};

export const serializeForMeta = (
  record: Pick<FinancialRecord, 'amount' | 'type' | 'category' | 'date' | 'notes'>
): {
  amount: string;
  type: string;
  category: string;
  date: string;
  notes: string | null;
} => {
  // CRITICAL: Prisma Decimal objects CANNOT be stored in Json fields.
  // This function converts Decimal to string BEFORE meta is written.
  // Without this, Prisma throws a serialization error at runtime.
  return {
    amount: record.amount.toFixed(2),
    type: record.type,
    category: record.category,
    date: record.date.toISOString(),
    notes: record.notes ?? null,
  };
};
