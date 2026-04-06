// src/modules/auth/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../utils/prismaClient';
import { AppError } from '../../utils/AppError';
import { AUDIT_ACTIONS } from '../../constants/auditActions';
import { safeUserSelect, SafeUser } from '../../utils/response';
import { LoginInput, RegisterInput } from './auth.validators';

// DUMMY_HASH — timing-safe login implementation.
//
// ATTACK EXPLAINED: If we return immediately when user not found
// (without running bcrypt), the response is fast (~1ms).
// When user IS found, bcrypt runs (~300ms). An attacker measuring
// response times can discover which emails exist in the system.
// This is a user enumeration timing attack.
//
// SOLUTION: Always run bcrypt.compare, even for invalid users.
// Use a pre-computed dummy hash as the fallback.
//
// WHY 1 ROUND (not 12):
// The dummy hash never needs to match a real password.
// It just needs to be a valid bcrypt hash so compare() runs
// its full execution path and returns false.
// 1 round ≈ 1ms at module load — negligible.
// 12 rounds ≈ 300ms — would noticeably delay server startup.
const DUMMY_HASH = bcrypt.hashSync('dummy-placeholder', 1);

interface LoginResponse {
  user: SafeUser;
  token: string;
  expiresIn: string;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const user = await prisma.user.findUnique({ where: { email } });
  const hashToCompare = user?.password ?? DUMMY_HASH;
  const isValid = await bcrypt.compare(password, hashToCompare);

  // Identical message for wrong email AND wrong password.
  // Never reveal which one failed.
  if (!user || !isValid) {
    throw new AppError(
      'Invalid email or password',
      401,
      'INVALID_CREDENTIALS'
    );
  }

  if (user.status === 'INACTIVE') {
    throw AppError.forbidden('Account deactivated. Contact admin.');
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] }
  );

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN,
      entity: 'User',
      entityId: user.id,
    },
  });

  const safeUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: safeUserSelect,
  });

  if (!safeUser) {
    throw AppError.notFound('User');
  }

  return { user: safeUser, token, expiresIn: env.JWT_EXPIRES_IN };
}

interface RegisterResponse {
  user: SafeUser;
}

export async function register(data: RegisterInput): Promise<RegisterResponse> {
  const hashedPassword = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role,
      status: 'ACTIVE',
    },
    select: safeUserSelect,
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: AUDIT_ACTIONS.REGISTER,
      entity: 'User',
      entityId: user.id,
    },
  });

  return { user };
}

export async function getMe(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });

  if (!user) {
    throw AppError.notFound('User');
  }

  return user;
}
