// src/modules/users/user.service.ts
import { Role, Status, Prisma } from '@prisma/client';
import { prisma } from '../../utils/prismaClient';
import { AppError } from '../../utils/AppError';
import { AUDIT_ACTIONS } from '../../constants/auditActions';
import {
  safeUserSelect,
  SafeUser,
  PaginationMeta,
} from '../../utils/response';
import { UpdateUserInput, ListUsersQuery } from './user.validators';

interface ListUsersResponse {
  users: SafeUser[];
  meta: PaginationMeta;
}

export async function listUsers(query: ListUsersQuery): Promise<ListUsersResponse> {
  const { page, limit, status, role } = query;

  const where: Prisma.UserWhereInput = {
    ...(status && { status }),
    ...(role && { role }),
  };

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      // Without stable sort order, paginated results shift between pages.
      select: safeUserSelect,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUser(id: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: safeUserSelect,
  });

  if (!user) {
    throw AppError.notFound('User');
  }

  return user;
}

interface UpdateUserContext {
  currentUserId: string;
  targetUserId: string;
  data: UpdateUserInput;
}

export async function updateUser(ctx: UpdateUserContext): Promise<SafeUser> {
  const { currentUserId, targetUserId, data } = ctx;

  // Step 1: fetch FIRST before any guard checks
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    throw AppError.notFound('User');
  }

  // Step 2: self-protection
  if (currentUserId === targetUserId && data.role !== undefined) {
    throw AppError.forbidden('Cannot change your own role');
  }
  if (currentUserId === targetUserId && data.status === 'INACTIVE') {
    throw AppError.forbidden('Cannot deactivate your own account');
  }

  // Step 3: build one AuditLog entry per changed field
  // If role AND status both change → TWO AuditLog entries
  const auditEntries: Prisma.AuditLogCreateArgs[] = [];

  if (data.role && data.role !== user.role) {
    auditEntries.push({
      data: {
        userId: currentUserId,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
        entity: 'User',
        entityId: targetUserId,
        meta: { from: user.role, to: data.role },
      },
    });
  }

  if (data.status && data.status !== user.status) {
    auditEntries.push({
      data: {
        userId: currentUserId,
        action: AUDIT_ACTIONS.USER_STATUS_CHANGE,
        entity: 'User',
        entityId: targetUserId,
        meta: { from: user.status, to: data.status },
      },
    });
  }

  // Step 4: atomic transaction — update + all audit entries
  const txResults = await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data,
      select: safeUserSelect,
    }),
    ...auditEntries.map((e) => prisma.auditLog.create(e)),
  ]);

  // Explicit cast — $transaction returns mixed array
  return txResults[0] as SafeUser;
}

interface DeactivateUserContext {
  currentUserId: string;
  targetUserId: string;
}

export async function deactivateUser(
  ctx: DeactivateUserContext
): Promise<void> {
  const { currentUserId, targetUserId } = ctx;

  // Fetch first → 404 if not found
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    throw AppError.notFound('User');
  }

  // Self-check → 403
  if (currentUserId === targetUserId) {
    throw AppError.forbidden('Cannot deactivate your own account');
  }

  // $transaction: status=INACTIVE + AuditLog USER_DEACTIVATE
  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { status: Status.INACTIVE },
    }),
    prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: AUDIT_ACTIONS.USER_DEACTIVATE,
        entity: 'User',
        entityId: targetUserId,
        meta: { from: user.status, to: Status.INACTIVE },
      },
    }),
  ]);
}
