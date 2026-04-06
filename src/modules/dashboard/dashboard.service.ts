// src/modules/dashboard/dashboard.service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prismaClient';
import { serializeRecords } from '../../utils/serializers';
import type { SerializedRecord } from '../../utils/serializers';

interface SummaryResponse {
  totalIncome: string;
  totalExpenses: string;
  netBalance: string;
  totalRecords: number;
  incomeCount: number;
  expenseCount: number;
}

export async function getSummary(): Promise<SummaryResponse> {
  // Use groupBy(['type']) with _sum.amount and _count.id
  const grouped = await prisma.financialRecord.groupBy({
    by: ['type'],
    where: { isDeleted: false },
    _sum: { amount: true },
    _count: { id: true },
  });

  const zero = new Prisma.Decimal(0);
  // new keyword is required — Prisma.Decimal IS a class

  const incomeRow = grouped.find((g) => g.type === 'INCOME');
  const expenseRow = grouped.find((g) => g.type === 'EXPENSE');

  const totalIncome = incomeRow?._sum.amount ?? zero;
  const totalExpenses = expenseRow?._sum.amount ?? zero;

  // Decimal arithmetic — NEVER JS Number subtraction for money
  // JS: 0.1 + 0.2 = 0.30000000000000004
  // In a finance system this causes incorrect balances.
  const netBalance = totalIncome.sub(totalExpenses);

  // Convert ALL Decimals to string before response
  return {
    totalIncome: totalIncome.toFixed(2),
    totalExpenses: totalExpenses.toFixed(2),
    netBalance: netBalance.toFixed(2),
    totalRecords:
      (incomeRow?._count.id ?? 0) + (expenseRow?._count.id ?? 0),
    incomeCount: incomeRow?._count.id ?? 0,
    expenseCount: expenseRow?._count.id ?? 0,
  };
}

interface CategoryItem {
  category: string;
  type: string;
  total: string;
  count: number;
}

export async function getByCategory(): Promise<CategoryItem[]> {
  const grouped = await prisma.financialRecord.groupBy({
    by: ['category', 'type'],
    where: { isDeleted: false },
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: 'desc' } },
  });

  return grouped.map((g) => ({
    category: g.category,
    type: g.type,
    total: g._sum.amount?.toFixed(2) ?? '0.00',
    count: g._count.id,
  }));
}

interface RawTrendRow {
  period: string;
  type: 'INCOME' | 'EXPENSE';
  total: string; // SUM cast to ::text in SQL
  count: number; // COUNT cast to ::int in SQL
}

interface TrendDataPoint {
  period: string;
  income: string;
  expenses: string;
  net: string;
}

interface TrendsResponse {
  granularity: string;
  data: TrendDataPoint[];
}

function buildMonthlyTrends(rows: RawTrendRow[]): TrendDataPoint[] {
  const year = new Date().getFullYear();
  // Generate all 12 YYYY-MM strings for the current year
  const allPeriods = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  return allPeriods.map((period) => {
    const incomeRow = rows.find(
      (r) => r.period === period && r.type === 'INCOME'
    );
    const expenseRow = rows.find(
      (r) => r.period === period && r.type === 'EXPENSE'
    );
    const income = parseFloat(incomeRow?.total ?? '0');
    const expenses = parseFloat(expenseRow?.total ?? '0');
    return {
      period,
      income: income.toFixed(2),
      expenses: expenses.toFixed(2),
      net: (income - expenses).toFixed(2),
      // JS arithmetic safe here: values came back as ::text strings
      // already rounded to 2dp by Postgres SUM on NUMERIC column.
    };
  });
}

function buildWeeklyTrends(rows: RawTrendRow[]): TrendDataPoint[] {
  // Generate last 12 ISO week-start dates (Mondays)
  const periods: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    // Align to Monday (ISO week start)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    periods.push(d.toISOString().split('T')[0]);
  }

  return periods.map((period) => {
    const incomeRow = rows.find(
      (r) => r.period === period && r.type === 'INCOME'
    );
    const expenseRow = rows.find(
      (r) => r.period === period && r.type === 'EXPENSE'
    );
    const income = parseFloat(incomeRow?.total ?? '0');
    const expenses = parseFloat(expenseRow?.total ?? '0');
    return {
      period,
      income: income.toFixed(2),
      expenses: expenses.toFixed(2),
      net: (income - expenses).toFixed(2),
    };
  });
}

export async function getTrends(granularity: string): Promise<TrendsResponse> {
  // Required in TypeScript strict mode.
  // Without the generic type, $queryRaw returns unknown[]
  // and accessing .period, .type, .total causes compile error.

  let rows: RawTrendRow[];

  if (granularity === 'monthly') {
    // Monthly SQL (current year)
    rows = await prisma.$queryRaw<RawTrendRow[]>(Prisma.sql`
      SELECT
        TO_CHAR(date_trunc('month', date), 'YYYY-MM') AS period,
        type,
        SUM(amount)::text AS total,
        COUNT(*)::int     AS count
      FROM "FinancialRecord"
      WHERE "isDeleted" = false
      AND date >= date_trunc('year', CURRENT_DATE)
      AND date <  date_trunc('year', CURRENT_DATE) + INTERVAL '1 year'
      GROUP BY period, type
      ORDER BY period ASC
    `);
  } else {
    // Weekly SQL (last 12 weeks)
    rows = await prisma.$queryRaw<RawTrendRow[]>(Prisma.sql`
      SELECT
        TO_CHAR(date_trunc('week', date), 'YYYY-MM-DD') AS period,
        type,
        SUM(amount)::text AS total,
        COUNT(*)::int     AS count
      FROM "FinancialRecord"
      WHERE "isDeleted" = false
      AND date >= CURRENT_DATE - INTERVAL '12 weeks'
      GROUP BY period, type
      ORDER BY period ASC
    `);
  }

  return {
    granularity,
    data:
      granularity === 'monthly'
        ? buildMonthlyTrends(rows)
        : buildWeeklyTrends(rows),
  };
}

export async function getRecent(): Promise<{ data: SerializedRecord[] }> {
  const records = await prisma.financialRecord.findMany({
    where: { isDeleted: false },
    orderBy: { date: 'desc' },
    take: 10,
  });

  return { data: serializeRecords(records) };
}
