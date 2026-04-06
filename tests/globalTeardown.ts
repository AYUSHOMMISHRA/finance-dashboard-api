// tests/globalTeardown.ts
import { PrismaClient } from '@prisma/client';

export default async function globalTeardown(): Promise<void> {
  const prisma = new PrismaClient();
  await prisma.$disconnect();
  // Without this Jest hangs after tests complete.
  // --forceExit masks but does not fix the underlying issue.
}
