// src/types/express.d.ts
import { Role, Status } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
        status: Status;
      };
    }
    interface Locals {
      requestId: string;
    }
  }
}

export {};
