import { PrismaClient, Role, RecordType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AUDIT_ACTIONS } from '../src/constants/auditActions';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // RULE 1 — IDEMPOTENCY: start by deleting in FK-safe order
  await prisma.auditLog.deleteMany();
  await prisma.financialRecord.deleteMany();
  await prisma.user.deleteMany();

  // Create 3 users via Promise.all
  const [admin, analyst, viewer] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@finance.com',
        password: await bcrypt.hash('Admin@123', 12),
        role: Role.ADMIN,
        status: 'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Analyst User',
        email: 'analyst@finance.com',
        password: await bcrypt.hash('Analyst@123', 12),
        role: Role.ANALYST,
        status: 'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Viewer User',
        email: 'viewer@finance.com',
        password: await bcrypt.hash('Viewer@123', 12),
        role: Role.VIEWER,
        status: 'ACTIVE',
      },
    }),
  ]);

  // Create 30 records via Promise.all
  // Spread across ALL 12 months of current year, 2+ per month
  const currentYear = new Date().getFullYear();

  const recordsData = [
    // January
    { amount: '5000.00', type: RecordType.INCOME, category: 'salary', date: new Date(currentYear,
 0, 15) },                                                                                           { amount: '1200.00', type: RecordType.EXPENSE, category: 'rent', date: new Date(currentYear, 
0, 5) },                                                                                             { amount: '300.00', type: RecordType.EXPENSE, category: 'groceries', date: new Date(currentYe
ar, 0, 20) },                                                                                        // February
    { amount: '800.00', type: RecordType.INCOME, category: 'freelance', date: new Date(currentYea
r, 1, 10) },                                                                                         { amount: '150.00', type: RecordType.EXPENSE, category: 'utilities', date: new Date(currentYe
ar, 1, 15) },                                                                                        { amount: '200.00', type: RecordType.EXPENSE, category: 'entertainment', date: new Date(curre
ntYear, 1, 25) },                                                                                    // March - SPIKE: multiple income sources
    { amount: '5000.00', type: RecordType.INCOME, category: 'salary', date: new Date(currentYear,
 2, 15) },                                                                                           { amount: '3000.00', type: RecordType.INCOME, category: 'bonus', date: new Date(currentYear, 
2, 20) },                                                                                            { amount: '2000.00', type: RecordType.INCOME, category: 'freelance', date: new Date(currentYe
ar, 2, 25) },                                                                                        { amount: '1200.00', type: RecordType.EXPENSE, category: 'rent', date: new Date(currentYear, 
2, 5) },                                                                                             // April
    { amount: '5000.00', type: RecordType.INCOME, category: 'salary', date: new Date(currentYear,
 3, 15) },                                                                                           { amount: '500.00', type: RecordType.EXPENSE, category: 'travel', date: new Date(currentYear,
 3, 10) },                                                                                           // May
    { amount: '5000.00', type: RecordType.INCOME, category: 'salary', date: new Date(currentYear,
 4, 15) },                                                                                           { amount: '250.00', type: RecordType.EXPENSE, category: 'insurance', date: new Date(currentYe
ar, 4, 1) },                                                                                         { amount: '400.00', type: RecordType.EXPENSE, category: 'equipment', date: new Date(currentYe
ar, 4, 20) },                                                                                        // June
    { amount: '5500.00', type: RecordType.INCOME, category: 'salary', date: new Date(currentYear,
 5, 15) },                                                                                           { amount: '1200.00', type: RecordType.EXPENSE, category: 'rent', date: new Date(currentYear, 
5, 5) },                                                                                             // July
    { amount: '5000.00', type: RecordType.INCOME, category: 'salary', date: new Date(currentYear,
 6, 15) },                                                                                           { amount: '1000.00', type: RecordType.INCOME, category: 'investment', date: new Date(currentY
ear, 6, 30) },                                                                                       { amount: '300.00', type: RecordType.EXPENSE, category: 'medical', date: new Date(currentYear
, 6, 10) },                                                                                          // August
    { amount: '5000.00', type: RecordType.INCOME, category: 'salary', date: new Date(currentYear,
 7, 15) },                                                                                           { amount: '600.00', type: RecordType.EXPENSE, category: 'travel', date: new Date(currentYear,
 7, 15) },                                                                                           // September
    { amount: '5200.00', type: RecordType.INCOME, category: 'salary', date: new Date(currentYear,
 8, 15) },                                                                                           { amount: '1200.00', type: RecordType.EXPENSE, category: 'rent', date: new Date(currentYear, 
8, 5) },                                                                                             { amount: '350.00', type: RecordType.EXPENSE, category: 'groceries', date: new Date(currentYe
ar, 8, 25) },                                                                                        // October
    { amount: '5000.00', type: RecordType.INCOME, category: 'salary', date: new Date(currentYear,
 9, 15) },                                                                                           { amount: '150.00', type: RecordType.EXPENSE, category: 'utilities', date: new Date(currentYe
ar, 9, 10) },                                                                                        // November
    { amount: '5000.00', type: RecordType.INCOME, category: 'salary', date: new Date(currentYear,
 10, 15) },                                                                                          { amount: '800.00', type: RecordType.EXPENSE, category: 'equipment', date: new Date(currentYe
ar, 10, 20) },                                                                                       // December
    { amount: '6000.00', type: RecordType.INCOME, category: 'salary', date: new Date(currentYear,
 11, 15) },                                                                                          { amount: '2000.00', type: RecordType.INCOME, category: 'bonus', date: new Date(currentYear, 
11, 20) },                                                                                           { amount: '1500.00', type: RecordType.EXPENSE, category: 'entertainment', date: new Date(curr
entYear, 11, 25) },                                                                                ];

  // RULE 3 — Promise.all for record creates
  await Promise.all(
    recordsData.map((record) =>
      prisma.financialRecord.create({
        data: {
          ...record,
          createdById: admin.id,
          isDeleted: false,
        },
      })
    )
  );

  // 3 AuditLog entries in $transaction (small set, safe)
  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: AUDIT_ACTIONS.LOGIN,
        entity: 'User',
        entityId: admin.id,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: analyst.id,
        action: AUDIT_ACTIONS.LOGIN,
        entity: 'User',
        entityId: analyst.id,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: viewer.id,
        action: AUDIT_ACTIONS.LOGIN,
        entity: 'User',
        entityId: viewer.id,
      },
    }),
  ]);

  console.info('Seed complete: 3 users, 30 records');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // RULE 4 — END WITH DISCONNECT
    await prisma.$disconnect();
  });
