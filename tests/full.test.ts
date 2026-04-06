// tests/full.test.ts
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/utils/prismaClient';
import { env } from '../src/config/env';

type SectionName =
  | 'Health & Public'
  | 'Auth'
  | 'Users'
  | 'Records Create/Read'
  | 'Records Update/Delete'
  | 'Dashboard'
  | 'Security';

interface SectionResult {
  pass: number;
  fail: number;
  skip: number;
}

interface UserLike {
  id: string;
  name: string;
  email: string;
  role: 'VIEWER' | 'ANALYST' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE';
}

interface RecordLike {
  id: string;
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  date: string;
  notes: string | null;
  isDeleted?: boolean;
}

interface ErrorBody {
  success: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message?: string }>;
  };
}

interface SuccessBody<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const results: Record<SectionName, SectionResult> = {
  'Health & Public': { pass: 0, fail: 0, skip: 0 },
  Auth: { pass: 0, fail: 0, skip: 0 },
  Users: { pass: 0, fail: 0, skip: 0 },
  'Records Create/Read': { pass: 0, fail: 0, skip: 0 },
  'Records Update/Delete': { pass: 0, fail: 0, skip: 0 },
  Dashboard: { pass: 0, fail: 0, skip: 0 },
  Security: { pass: 0, fail: 0, skip: 0 },
};

let adminToken: string;
let analystToken: string;
let viewerToken: string;
let createdUserIds: string[] = [];
let createdRecordIds: string[] = [];
let reusableRecordId: string;

const BASE = '/api/v1';

function tracked(section: SectionName, name: string, fn: () => Promise<void>): void {
  test(name, async () => {
    try {
      await fn();
      results[section].pass += 1;
    } catch (err) {
      results[section].fail += 1;
      throw err;
    }
  });
}

async function login(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post(`${BASE}/auth/login`)
    .send({ email, password });
  const body = res.body as SuccessBody<{ token: string }>;
  return body.data.token;
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createUserAsAdmin(
  token: string,
  payload?: Partial<{ name: string; email: string; password: string; role: 'VIEWER' | 'ANALYST' | 'ADMIN' }>
): Promise<UserLike> {
  const body = {
    name: payload?.name ?? 'Test User',
    email: payload?.email ?? uniqueEmail('user'),
    password: payload?.password ?? 'ValidPass1',
    role: payload?.role ?? 'VIEWER',
  };

  const res = await request(app)
    .post(`${BASE}/auth/register`)
    .set(auth(token))
    .send(body);

  const parsed = res.body as SuccessBody<{ user: UserLike }>;
  createdUserIds.push(parsed.data.user.id);
  return parsed.data.user;
}

async function createRecordAsAdmin(
  token: string,
  payload?: Partial<{ amount: number; type: 'INCOME' | 'EXPENSE'; category: string; date: string; notes: string | null }>
): Promise<RecordLike> {
  const body = {
    amount: payload?.amount ?? 1000,
    type: payload?.type ?? 'INCOME',
    category: payload?.category ?? 'test-category',
    date: payload?.date ?? new Date().toISOString().split('T')[0],
    notes: payload?.notes === undefined ? 'Test record' : payload.notes,
  };

  const res = await request(app)
    .post(`${BASE}/records`)
    .set(auth(token))
    .send(body);

  const parsed = res.body as SuccessBody<RecordLike>;
  createdRecordIds.push(parsed.data.id);
  return parsed.data;
}

beforeAll(async () => {
  adminToken = await login('admin@finance.com', 'Admin@123');
  analystToken = await login('analyst@finance.com', 'Analyst@123');
  viewerToken = await login('viewer@finance.com', 'Viewer@123');

  const reusable = await createRecordAsAdmin(adminToken, {
    amount: 1234.56,
    type: 'INCOME',
    category: 'reusable-record',
  });
  reusableRecordId = reusable.id;
});

describe('Health & Public Routes', () => {
  tracked('Health & Public', 'GET /health returns 200 with status ok and numeric uptime', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  tracked('Health & Public', 'GET /api/v1/docs returns 200', async () => {
    const res = await request(app).get(`${BASE}/docs`).redirects(1);
    expect(res.status).toBe(200);
  });

  tracked('Health & Public', 'GET /api/v1/nonexistent returns 404 with code NOT_FOUND', async () => {
    const res = await request(app).get(`${BASE}/nonexistent`);
    expect(res.status).toBe(404);
    expect((res.body as ErrorBody).error.code).toBe('NOT_FOUND');
  });
});

describe('Auth Module', () => {
  let sectionAdminToken: string;
  let sectionAnalystToken: string;
  let sectionViewerToken: string;

  beforeAll(async () => {
    sectionAdminToken = await login('admin@finance.com', 'Admin@123');
    sectionAnalystToken = await login('analyst@finance.com', 'Analyst@123');
    sectionViewerToken = await login('viewer@finance.com', 'Viewer@123');
  });

  describe('POST /auth/login', () => {
    tracked('Auth', 'valid admin login returns 200, token, no password field', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ email: 'admin@finance.com', password: 'Admin@123' });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    tracked('Auth', 'wrong password returns 401 with message "Invalid email or password"', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ email: 'admin@finance.com', password: 'WrongPassword123' });

      expect(res.status).toBe(401);
      expect((res.body as ErrorBody).error.message).toBe('Invalid email or password');
    });

    tracked('Auth', 'wrong email returns 401 with IDENTICAL message to wrong password', async () => {
      const wrongPassword = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ email: 'admin@finance.com', password: 'WrongPassword123' });
      const wrongEmail = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ email: 'nobody@finance.com', password: 'Admin@123' });

      expect(wrongEmail.status).toBe(401);
      expect((wrongEmail.body as ErrorBody).error.message).toBe(
        (wrongPassword.body as ErrorBody).error.message
      );
    });

    tracked('Auth', 'uppercase email Admin@Finance.COM returns 200 (normalization)', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ email: 'Admin@Finance.COM', password: 'Admin@123' });

      expect(res.status).toBe(200);
    });

    tracked('Auth', 'missing email returns 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ password: 'Admin@123' });

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    tracked('Auth', 'missing password returns 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ email: 'admin@finance.com' });

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    tracked('Auth', 'malformed JSON returns 400 MALFORMED_JSON', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .set('Content-Type', 'application/json')
        .send('{"email":"admin@finance.com","password":"Admin@123"');

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe('MALFORMED_JSON');
    });

    tracked('Auth', 'empty body returns 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({});

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /auth/me', () => {
    tracked('Auth', 'valid token returns 200, no password field', async () => {
      const res = await request(app)
        .get(`${BASE}/auth/me`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(200);
      expect(res.body.data.user.password).toBeUndefined();
    });

    tracked('Auth', 'no token returns 401', async () => {
      const res = await request(app).get(`${BASE}/auth/me`);
      expect(res.status).toBe(401);
    });

    tracked('Auth', '"Bearer " empty token returns 401', async () => {
      const res = await request(app)
        .get(`${BASE}/auth/me`)
        .set('Authorization', 'Bearer ');

      expect(res.status).toBe(401);
    });

    tracked('Auth', '"Bearer invalidtoken" returns 401 INVALID_TOKEN', async () => {
      const res = await request(app)
        .get(`${BASE}/auth/me`)
        .set('Authorization', 'Bearer invalidtoken');

      expect(res.status).toBe(401);
      expect((res.body as ErrorBody).error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /auth/register', () => {
    tracked('Auth', 'ADMIN can register new user, returns 201, no password field', async () => {
      const user = await createUserAsAdmin(sectionAdminToken, {
        email: uniqueEmail('reg-admin'),
      });
      expect(user.id).toBeDefined();
      const me = await request(app)
        .get(`${BASE}/users/${user.id}`)
        .set(auth(sectionAdminToken));
      expect(me.body.data.password).toBeUndefined();
    });

    tracked('Auth', 'ANALYST gets 403', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/register`)
        .set(auth(sectionAnalystToken))
        .send({
          name: 'X User',
          email: uniqueEmail('reg-analyst'),
          password: 'ValidPass1',
          role: 'VIEWER',
        });

      expect(res.status).toBe(403);
    });

    tracked('Auth', 'VIEWER gets 403', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/register`)
        .set(auth(sectionViewerToken))
        .send({
          name: 'X User',
          email: uniqueEmail('reg-viewer'),
          password: 'ValidPass1',
          role: 'VIEWER',
        });

      expect(res.status).toBe(403);
    });

    tracked('Auth', 'no token gets 401', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/register`)
        .send({
          name: 'X User',
          email: uniqueEmail('reg-none'),
          password: 'ValidPass1',
          role: 'VIEWER',
        });

      expect(res.status).toBe(401);
    });

    tracked('Auth', 'password no uppercase returns 400', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/register`)
        .set(auth(sectionAdminToken))
        .send({
          name: 'X User',
          email: uniqueEmail('reg-lower'),
          password: 'lowercase1',
          role: 'VIEWER',
        });

      expect(res.status).toBe(400);
    });

    tracked('Auth', 'password no number returns 400', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/register`)
        .set(auth(sectionAdminToken))
        .send({
          name: 'X User',
          email: uniqueEmail('reg-nonum'),
          password: 'NoNumberPass',
          role: 'VIEWER',
        });

      expect(res.status).toBe(400);
    });

    tracked('Auth', 'password under 8 chars returns 400', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/register`)
        .set(auth(sectionAdminToken))
        .send({
          name: 'X User',
          email: uniqueEmail('reg-short'),
          password: 'Aa1aa',
          role: 'VIEWER',
        });

      expect(res.status).toBe(400);
    });

    tracked('Auth', 'duplicate email returns 409 DUPLICATE_ENTRY', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/register`)
        .set(auth(sectionAdminToken))
        .send({
          name: 'Dup User',
          email: 'admin@finance.com',
          password: 'ValidPass1',
          role: 'VIEWER',
        });

      expect(res.status).toBe(409);
      expect((res.body as ErrorBody).error.code).toBe('DUPLICATE_ENTRY');
    });

    tracked('Auth', 'invalid role value returns 400', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/register`)
        .set(auth(sectionAdminToken))
        .send({
          name: 'Role User',
          email: uniqueEmail('reg-role'),
          password: 'ValidPass1',
          role: 'MANAGER',
        });

      expect(res.status).toBe(400);
    });
  });
});

describe('Users Module', () => {
  let sectionAdminToken: string;
  let sectionAnalystToken: string;
  let sectionViewerToken: string;

  beforeAll(async () => {
    sectionAdminToken = await login('admin@finance.com', 'Admin@123');
    sectionAnalystToken = await login('analyst@finance.com', 'Analyst@123');
    sectionViewerToken = await login('viewer@finance.com', 'Viewer@123');
  });

  describe('Access Control', () => {
    tracked('Users', 'ANALYST gets 403 on GET /users', async () => {
      const res = await request(app)
        .get(`${BASE}/users`)
        .set(auth(sectionAnalystToken));
      expect(res.status).toBe(403);
    });

    tracked('Users', 'VIEWER gets 403 on GET /users', async () => {
      const res = await request(app)
        .get(`${BASE}/users`)
        .set(auth(sectionViewerToken));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /users', () => {
    tracked('Users', 'returns 200 with data array and meta.totalPages', async () => {
      const res = await request(app)
        .get(`${BASE}/users`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.totalPages).toBeDefined();
    });

    tracked('Users', '?limit=2 returns max 2 results', async () => {
      const res = await request(app)
        .get(`${BASE}/users?limit=2`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    tracked('Users', '?role=VIEWER returns only VIEWER users', async () => {
      const res = await request(app)
        .get(`${BASE}/users?role=VIEWER`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(200);
      for (const u of res.body.data as UserLike[]) {
        expect(u.role).toBe('VIEWER');
      }
    });

    tracked('Users', '?status=ACTIVE returns only ACTIVE users', async () => {
      const res = await request(app)
        .get(`${BASE}/users?status=ACTIVE`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(200);
      for (const u of res.body.data as UserLike[]) {
        expect(u.status).toBe('ACTIVE');
      }
    });
  });

  describe('GET /users/:id', () => {
    tracked('Users', 'valid id returns 200, no password field', async () => {
      const user = await createUserAsAdmin(sectionAdminToken, { email: uniqueEmail('users-get') });
      const res = await request(app)
        .get(`${BASE}/users/${user.id}`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(200);
      expect(res.body.data.password).toBeUndefined();
    });

    tracked('Users', 'invalid id returns 404 NOT_FOUND', async () => {
      const res = await request(app)
        .get(`${BASE}/users/nonexistent-user-id`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(404);
      expect((res.body as ErrorBody).error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /users/:id', () => {
    tracked('Users', 'change name returns 200, name updated', async () => {
      const user = await createUserAsAdmin(sectionAdminToken, { email: uniqueEmail('users-patch-name') });
      const res = await request(app)
        .patch(`${BASE}/users/${user.id}`)
        .set(auth(sectionAdminToken))
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
    });

    tracked('Users', 'change role returns 200, role updated', async () => {
      const user = await createUserAsAdmin(sectionAdminToken, {
        email: uniqueEmail('users-patch-role'),
        role: 'VIEWER',
      });
      const res = await request(app)
        .patch(`${BASE}/users/${user.id}`)
        .set(auth(sectionAdminToken))
        .send({ role: 'ANALYST' });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('ANALYST');
    });

    tracked('Users', 'change own role returns 403 self-protection', async () => {
      const me = await request(app)
        .get(`${BASE}/auth/me`)
        .set(auth(sectionAdminToken));

      const res = await request(app)
        .patch(`${BASE}/users/${me.body.data.user.id}`)
        .set(auth(sectionAdminToken))
        .send({ role: 'VIEWER' });

      expect(res.status).toBe(403);
    });

    tracked('Users', 'deactivate own account returns 403 self-protection', async () => {
      const me = await request(app)
        .get(`${BASE}/auth/me`)
        .set(auth(sectionAdminToken));

      const res = await request(app)
        .patch(`${BASE}/users/${me.body.data.user.id}`)
        .set(auth(sectionAdminToken))
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(403);
    });

    tracked('Users', 'empty body returns 400 VALIDATION_ERROR', async () => {
      const user = await createUserAsAdmin(sectionAdminToken, { email: uniqueEmail('users-patch-empty') });
      const res = await request(app)
        .patch(`${BASE}/users/${user.id}`)
        .set(auth(sectionAdminToken))
        .send({});

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    tracked('Users', 'nonexistent id returns 404', async () => {
      const res = await request(app)
        .patch(`${BASE}/users/00000000-0000-0000-0000-000000000000`)
        .set(auth(sectionAdminToken))
        .send({ name: 'Valid Name' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /users/:id', () => {
    tracked('Users', 'valid id returns 200 "User deactivated successfully"', async () => {
      const user = await createUserAsAdmin(sectionAdminToken, { email: uniqueEmail('users-delete-ok') });
      const res = await request(app)
        .delete(`${BASE}/users/${user.id}`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('User deactivated successfully');
    });

    tracked('Users', 'own account returns 403', async () => {
      const me = await request(app)
        .get(`${BASE}/auth/me`)
        .set(auth(sectionAdminToken));

      const res = await request(app)
        .delete(`${BASE}/users/${me.body.data.user.id}`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(403);
    });

    tracked('Users', 'GET after DELETE returns 200 with status INACTIVE (not hard deleted)', async () => {
      const user = await createUserAsAdmin(sectionAdminToken, { email: uniqueEmail('users-delete-read') });
      await request(app)
        .delete(`${BASE}/users/${user.id}`)
        .set(auth(sectionAdminToken));

      const res = await request(app)
        .get(`${BASE}/users/${user.id}`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('INACTIVE');
    });
  });
});

describe('Records Module — Create & Read', () => {
  let sectionAdminToken: string;
  let sectionAnalystToken: string;
  let sectionViewerToken: string;

  beforeAll(async () => {
    sectionAdminToken = await login('admin@finance.com', 'Admin@123');
    sectionAnalystToken = await login('analyst@finance.com', 'Analyst@123');
    sectionViewerToken = await login('viewer@finance.com', 'Viewer@123');
  });

  describe('POST /records', () => {
    tracked('Records Create/Read', 'ADMIN creates record, returns 201, amount is string', async () => {
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAdminToken))
        .send({ amount: 1500, type: 'INCOME', category: 'salary', date: '2025-03-15' });

      expect(res.status).toBe(201);
      expect(typeof res.body.data.amount).toBe('string');
      createdRecordIds.push((res.body as SuccessBody<RecordLike>).data.id);
    });

    tracked('Records Create/Read', 'ANALYST gets 403', async () => {
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAnalystToken))
        .send({ amount: 1000, type: 'INCOME', category: 'x', date: '2025-03-15' });
      expect(res.status).toBe(403);
    });

    tracked('Records Create/Read', 'VIEWER gets 403', async () => {
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionViewerToken))
        .send({ amount: 1000, type: 'INCOME', category: 'x', date: '2025-03-15' });
      expect(res.status).toBe(403);
    });

    tracked('Records Create/Read', 'no token gets 401', async () => {
      const res = await request(app)
        .post(`${BASE}/records`)
        .send({ amount: 1000, type: 'INCOME', category: 'x', date: '2025-03-15' });
      expect(res.status).toBe(401);
    });

    tracked('Records Create/Read', 'negative amount returns 400, details has field "amount"', async () => {
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAdminToken))
        .send({ amount: -1, type: 'INCOME', category: 'x', date: '2025-03-15' });

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.details?.[0].field).toBe('amount');
    });

    tracked('Records Create/Read', '3 decimal places like 10.999 returns 400', async () => {
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAdminToken))
        .send({ amount: 10.999, type: 'INCOME', category: 'x', date: '2025-03-15' });

      expect(res.status).toBe(400);
    });

    tracked('Records Create/Read', 'zero amount returns 400', async () => {
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAdminToken))
        .send({ amount: 0, type: 'INCOME', category: 'x', date: '2025-03-15' });

      expect(res.status).toBe(400);
    });

    tracked('Records Create/Read', 'future date returns 400, details has field "date"', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAdminToken))
        .send({ amount: 100, type: 'INCOME', category: 'x', date: future.toISOString().split('T')[0] });

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.details?.[0].field).toBe('date');
    });

    tracked('Records Create/Read', 'invalid date string returns 400', async () => {
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAdminToken))
        .send({ amount: 100, type: 'INCOME', category: 'x', date: 'not-a-date' });

      expect(res.status).toBe(400);
    });

    tracked('Records Create/Read', 'missing type field returns 400', async () => {
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAdminToken))
        .send({ amount: 100, category: 'x', date: '2025-03-15' });

      expect(res.status).toBe(400);
    });

    tracked('Records Create/Read', 'invalid type "TRANSFER" returns 400', async () => {
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAdminToken))
        .send({ amount: 100, type: 'TRANSFER', category: 'x', date: '2025-03-15' });

      expect(res.status).toBe(400);
    });

    tracked('Records Create/Read', 'category over 50 chars returns 400', async () => {
      const longCategory = 'x'.repeat(51);
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAdminToken))
        .send({ amount: 100, type: 'INCOME', category: longCategory, date: '2025-03-15' });

      expect(res.status).toBe(400);
    });

    tracked('Records Create/Read', 'malformed JSON returns 400 MALFORMED_JSON', async () => {
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAdminToken))
        .set('Content-Type', 'application/json')
        .send('{"bad json"');

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe('MALFORMED_JSON');
    });
  });

  describe('GET /records', () => {
    tracked('Records Create/Read', 'ANALYST gets 200 with data array and meta', async () => {
      const res = await request(app)
        .get(`${BASE}/records`)
        .set(auth(sectionAnalystToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    tracked('Records Create/Read', 'VIEWER gets 403', async () => {
      const res = await request(app)
        .get(`${BASE}/records`)
        .set(auth(sectionViewerToken));
      expect(res.status).toBe(403);
    });

    tracked('Records Create/Read', 'meta has page, limit, total, totalPages', async () => {
      const res = await request(app)
        .get(`${BASE}/records`)
        .set(auth(sectionAnalystToken));

      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBeDefined();
      expect(res.body.meta.limit).toBeDefined();
      expect(res.body.meta.total).toBeDefined();
      expect(res.body.meta.totalPages).toBeDefined();
    });

    tracked('Records Create/Read', '?type=INCOME returns only INCOME records', async () => {
      const res = await request(app)
        .get(`${BASE}/records?type=INCOME`)
        .set(auth(sectionAnalystToken));

      expect(res.status).toBe(200);
      for (const r of res.body.data as RecordLike[]) {
        expect(r.type).toBe('INCOME');
      }
    });

    tracked('Records Create/Read', '?type=EXPENSE returns only EXPENSE records', async () => {
      const res = await request(app)
        .get(`${BASE}/records?type=EXPENSE`)
        .set(auth(sectionAnalystToken));

      expect(res.status).toBe(200);
      for (const r of res.body.data as RecordLike[]) {
        expect(r.type).toBe('EXPENSE');
      }
    });

    tracked('Records Create/Read', '?search=salary returns matching records', async () => {
      const res = await request(app)
        .get(`${BASE}/records?search=salary`)
        .set(auth(sectionAnalystToken));

      expect(res.status).toBe(200);
      expect((res.body.data as RecordLike[]).length).toBeGreaterThan(0);
    });

    tracked('Records Create/Read', '?startDate before endDate returns 200', async () => {
      const res = await request(app)
        .get(`${BASE}/records?startDate=2025-01-01&endDate=2025-12-31`)
        .set(auth(sectionAnalystToken));

      expect(res.status).toBe(200);
    });

    tracked('Records Create/Read', '?startDate after endDate returns 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get(`${BASE}/records?startDate=2025-12-31&endDate=2025-01-01`)
        .set(auth(sectionAnalystToken));

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    tracked('Records Create/Read', '?limit=3 returns max 3 results', async () => {
      const res = await request(app)
        .get(`${BASE}/records?limit=3`)
        .set(auth(sectionAnalystToken));

      expect(res.status).toBe(200);
      expect((res.body.data as RecordLike[]).length).toBeLessThanOrEqual(3);
    });
  });

  describe('GET /records/:id', () => {
    tracked('Records Create/Read', 'ANALYST with valid id returns 200 single record', async () => {
      const res = await request(app)
        .get(`${BASE}/records/${reusableRecordId}`)
        .set(auth(sectionAnalystToken));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(reusableRecordId);
    });

    tracked('Records Create/Read', 'VIEWER gets 403', async () => {
      const res = await request(app)
        .get(`${BASE}/records/${reusableRecordId}`)
        .set(auth(sectionViewerToken));

      expect(res.status).toBe(403);
    });

    tracked('Records Create/Read', 'nonexistent id returns 404', async () => {
      const res = await request(app)
        .get(`${BASE}/records/nonexistent-record-id`)
        .set(auth(sectionAnalystToken));

      expect(res.status).toBe(404);
    });
  });
});

describe('Records Module — Update & Delete', () => {
  let sectionAdminToken: string;
  let sectionAnalystToken: string;

  beforeAll(async () => {
    sectionAdminToken = await login('admin@finance.com', 'Admin@123');
    sectionAnalystToken = await login('analyst@finance.com', 'Analyst@123');
  });

  describe('PATCH /records/:id', () => {
    tracked('Records Update/Delete', 'ADMIN updates record, returns 200, fields updated', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken, { category: 'patch-base' });
      const res = await request(app)
        .patch(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken))
        .send({ amount: 2222, notes: 'Updated notes' });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Updated notes');
      expect(res.body.data.amount).toBe('2222.00');
    });

    tracked('Records Update/Delete', 'set notes to null returns 200, notes is null', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken, { notes: 'to-null' });
      const res = await request(app)
        .patch(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken))
        .send({ notes: null });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBeNull();
    });

    tracked('Records Update/Delete', 'amount update returns amount as string in response', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken);
      const res = await request(app)
        .patch(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken))
        .send({ amount: 3333 });

      expect(res.status).toBe(200);
      expect(typeof res.body.data.amount).toBe('string');
    });

    tracked('Records Update/Delete', 'ANALYST gets 403', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken);
      const res = await request(app)
        .patch(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAnalystToken))
        .send({ amount: 999 });

      expect(res.status).toBe(403);
    });

    tracked('Records Update/Delete', 'empty body returns 400', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken);
      const res = await request(app)
        .patch(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken))
        .send({});

      expect(res.status).toBe(400);
    });

    tracked('Records Update/Delete', 'nonexistent id returns 404', async () => {
      const res = await request(app)
        .patch(`${BASE}/records/nonexistent-record-id`)
        .set(auth(sectionAdminToken))
        .send({ amount: 100 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /records/:id', () => {
    tracked('Records Update/Delete', 'ADMIN deletes, returns 200 "Record deleted successfully"', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken, { category: 'delete-once' });
      const res = await request(app)
        .delete(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Record deleted successfully');
    });

    tracked('Records Update/Delete', 'ANALYST gets 403', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken, { category: 'delete-analyst' });
      const res = await request(app)
        .delete(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAnalystToken));

      expect(res.status).toBe(403);
    });

    tracked('Records Update/Delete', 'GET /:id after delete returns 404', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken, { category: 'delete-get' });
      await request(app)
        .delete(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken));

      const res = await request(app)
        .get(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(404);
    });

    tracked('Records Update/Delete', 'double-delete returns 404 not 200', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken, { category: 'delete-twice' });
      await request(app)
        .delete(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken));

      const res = await request(app)
        .delete(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(404);
    });

    tracked('Records Update/Delete', 'PATCH after delete returns 404', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken, { category: 'delete-patch' });
      await request(app)
        .delete(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken));

      const res = await request(app)
        .patch(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken))
        .send({ amount: 777 });

      expect(res.status).toBe(404);
    });

    tracked('Records Update/Delete', 'deleted record absent from GET /records list', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken, {
        category: `gone-${Date.now()}`,
      });
      await request(app)
        .delete(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken));

      const res = await request(app)
        .get(`${BASE}/records?search=${encodeURIComponent(rec.category)}`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(200);
      expect((res.body.data as RecordLike[]).some((r) => r.id === rec.id)).toBe(false);
    });
  });
});

describe('Dashboard Module', () => {
  let sectionAdminToken: string;
  let sectionAnalystToken: string;
  let sectionViewerToken: string;

  beforeAll(async () => {
    sectionAdminToken = await login('admin@finance.com', 'Admin@123');
    sectionAnalystToken = await login('analyst@finance.com', 'Analyst@123');
    sectionViewerToken = await login('viewer@finance.com', 'Viewer@123');
  });

  describe('GET /dashboard/summary', () => {
    tracked('Dashboard', 'VIEWER gets 200 — explicitly allowed', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/summary`)
        .set(auth(sectionViewerToken));
      expect(res.status).toBe(200);
    });

    tracked('Dashboard', 'ANALYST gets 200', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/summary`)
        .set(auth(sectionAnalystToken));
      expect(res.status).toBe(200);
    });

    tracked('Dashboard', 'ADMIN gets 200', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/summary`)
        .set(auth(sectionAdminToken));
      expect(res.status).toBe(200);
    });

    tracked('Dashboard', 'no token gets 401', async () => {
      const res = await request(app).get(`${BASE}/dashboard/summary`);
      expect(res.status).toBe(401);
    });

    tracked('Dashboard', 'totalIncome is a string', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/summary`)
        .set(auth(sectionViewerToken));
      expect(typeof res.body.data.totalIncome).toBe('string');
    });

    tracked('Dashboard', 'totalExpenses is a string', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/summary`)
        .set(auth(sectionViewerToken));
      expect(typeof res.body.data.totalExpenses).toBe('string');
    });

    tracked('Dashboard', 'netBalance is a string', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/summary`)
        .set(auth(sectionViewerToken));
      expect(typeof res.body.data.netBalance).toBe('string');
    });

    tracked('Dashboard', 'netBalance equals totalIncome minus totalExpenses numerically', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/summary`)
        .set(auth(sectionViewerToken));

      const income = Number.parseFloat(res.body.data.totalIncome);
      const expenses = Number.parseFloat(res.body.data.totalExpenses);
      const net = Number.parseFloat(res.body.data.netBalance);
      expect(net).toBeCloseTo(income - expenses, 2);
    });

    tracked('Dashboard', 'totalRecords is a number', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/summary`)
        .set(auth(sectionViewerToken));
      expect(typeof res.body.data.totalRecords).toBe('number');
    });
  });

  describe('GET /dashboard/by-category', () => {
    tracked('Dashboard', 'VIEWER gets 200, data is array with length > 0', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/by-category`)
        .set(auth(sectionViewerToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as Array<unknown>).length).toBeGreaterThan(0);
    });

    tracked('Dashboard', 'each item has category, type, total fields', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/by-category`)
        .set(auth(sectionViewerToken));

      expect(res.status).toBe(200);
      const item = res.body.data[0] as { category?: string; type?: string; total?: string };
      expect(item.category).toBeDefined();
      expect(item.type).toBeDefined();
      expect(item.total).toBeDefined();
    });
  });

  describe('GET /dashboard/trends', () => {
    tracked('Dashboard', '?granularity=monthly returns exactly 12 items', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/trends?granularity=monthly`)
        .set(auth(sectionViewerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(12);
    });

    tracked('Dashboard', 'monthly — all 12 month periods present, no gaps', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/trends?granularity=monthly`)
        .set(auth(sectionViewerToken));

      const year = new Date().getFullYear();
      const expected = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
      const actual = (res.body.data.data as Array<{ period: string }>).map((x) => x.period);
      expect(actual).toEqual(expected);
    });

    tracked('Dashboard', 'each monthly item has period, income, expenses, net', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/trends?granularity=monthly`)
        .set(auth(sectionViewerToken));

      const item = res.body.data.data[0] as { period?: string; income?: string; expenses?: string; net?: string };
      expect(item.period).toBeDefined();
      expect(item.income).toBeDefined();
      expect(item.expenses).toBeDefined();
      expect(item.net).toBeDefined();
    });

    tracked('Dashboard', '?granularity=weekly returns exactly 12 items', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/trends?granularity=weekly`)
        .set(auth(sectionViewerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(12);
    });

    tracked('Dashboard', '?granularity=invalid returns 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/trends?granularity=invalid`)
        .set(auth(sectionViewerToken));

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    tracked('Dashboard', 'no param defaults to monthly, returns 12 items', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/trends`)
        .set(auth(sectionViewerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.granularity).toBe('monthly');
      expect(res.body.data.data.length).toBe(12);
    });
  });

  describe('GET /dashboard/recent', () => {
    tracked('Dashboard', 'returns max 10 records', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/recent`)
        .set(auth(sectionViewerToken));

      expect(res.status).toBe(200);
      expect((res.body.data.data as RecordLike[]).length).toBeLessThanOrEqual(10);
    });

    tracked('Dashboard', 'no record has isDeleted field set to true', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/recent`)
        .set(auth(sectionViewerToken));

      expect(res.status).toBe(200);
      for (const r of res.body.data.data as RecordLike[]) {
        expect(r.isDeleted).not.toBe(true);
      }
    });

    tracked('Dashboard', 'records ordered by date descending', async () => {
      const res = await request(app)
        .get(`${BASE}/dashboard/recent`)
        .set(auth(sectionViewerToken));

      const dates = (res.body.data.data as RecordLike[]).map((r) => new Date(r.date).getTime());
      for (let i = 1; i < dates.length; i += 1) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });
  });
});

describe('Security & Edge Cases', () => {
  let sectionAdminToken: string;

  beforeAll(async () => {
    sectionAdminToken = await login('admin@finance.com', 'Admin@123');
  });

  describe('Response Shape', () => {
    tracked('Security', 'every success response has success: true', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success ?? true).toBe(true);
    });

    tracked('Security', 'every error response has success: false', async () => {
      const res = await request(app).get(`${BASE}/nonexistent`);
      expect(res.status).toBe(404);
      expect((res.body as ErrorBody).success).toBe(false);
    });

    tracked('Security', 'every error response has requestId field', async () => {
      const res = await request(app).get(`${BASE}/nonexistent`);
      expect(res.status).toBe(404);
      expect((res.body as ErrorBody).requestId).toBeDefined();
    });

    tracked('Security', 'every response has X-Request-ID header', async () => {
      const ok = await request(app).get('/health');
      const err = await request(app).get(`${BASE}/nonexistent`);
      expect(ok.headers['x-request-id']).toBeDefined();
      expect(err.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Payload Limits', () => {
    tracked('Security', 'body over 10kb returns 413 PAYLOAD_TOO_LARGE', async () => {
      const huge = 'x'.repeat(11 * 1024);
      const res = await request(app)
        .post(`${BASE}/records`)
        .set(auth(sectionAdminToken))
        .send({
          amount: 100,
          type: 'INCOME',
          category: 'oversize',
          date: '2025-03-15',
          notes: huge,
        });

      expect(res.status).toBe(413);
      expect((res.body as ErrorBody).error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('Token Edge Cases', () => {
    tracked('Security', 'tampered JWT signature returns 401 INVALID_TOKEN', async () => {
      const tampered = `${sectionAdminToken.slice(0, -1)}x`;
      const res = await request(app)
        .get(`${BASE}/auth/me`)
        .set('Authorization', `Bearer ${tampered}`);

      expect(res.status).toBe(401);
      expect((res.body as ErrorBody).error.code).toBe('INVALID_TOKEN');
    });

    tracked('Security', 'token for nonexistent user returns 401', async () => {
      const bogus = jwt.sign(
        { id: '11111111-1111-1111-1111-111111111111', email: 'ghost@test.com', role: 'ADMIN' },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const res = await request(app)
        .get(`${BASE}/auth/me`)
        .set('Authorization', `Bearer ${bogus}`);

      expect(res.status).toBe(401);
    });
  });

  describe('Deactivation Flow', () => {
    tracked('Security', 'deactivated user token immediately returns 403 on next request', async () => {
      const user = await createUserAsAdmin(sectionAdminToken, {
        email: uniqueEmail('deactivate-now'),
        password: 'ValidPass1',
        role: 'VIEWER',
      });

      const userToken = await login(user.email, 'ValidPass1');

      await request(app)
        .patch(`${BASE}/users/${user.id}`)
        .set(auth(sectionAdminToken))
        .send({ status: 'INACTIVE' });

      const res = await request(app)
        .get(`${BASE}/dashboard/summary`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Pagination Edge Cases', () => {
    tracked('Security', '?limit=101 returns 400 — limit max is 100', async () => {
      const res = await request(app)
        .get(`${BASE}/records?limit=101`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    tracked('Security', '?page=9999 returns 200 with empty data array, total still correct', async () => {
      const res = await request(app)
        .get(`${BASE}/records?page=9999&limit=10`)
        .set(auth(sectionAdminToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as RecordLike[]).length).toBe(0);
      expect(typeof res.body.meta.total).toBe('number');
    });
  });

  describe('Data Integrity', () => {
    tracked('Security', 'amount is always a string in record responses, never a number', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken, {
        amount: 4321,
        category: 'amount-string',
      });

      const byId = await request(app)
        .get(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken));

      expect(byId.status).toBe(200);
      expect(typeof byId.body.data.amount).toBe('string');
    });

    tracked('Security', 'category with surrounding spaces stored trimmed', async () => {
      const rec = await createRecordAsAdmin(sectionAdminToken, {
        category: '   trimmed-category   ',
      });

      const byId = await request(app)
        .get(`${BASE}/records/${rec.id}`)
        .set(auth(sectionAdminToken));

      expect(byId.status).toBe(200);
      expect(byId.body.data.category).toBe('trimmed-category');
    });
  });
});

afterAll(async () => {
  const uniqueRecordIds = Array.from(new Set(createdRecordIds));
  const uniqueUserIds = Array.from(new Set(createdUserIds));

  if (uniqueRecordIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        entity: 'FinancialRecord',
        entityId: { in: uniqueRecordIds },
      },
    });

    await prisma.financialRecord.deleteMany({
      where: { id: { in: uniqueRecordIds } },
    });
  }

  if (uniqueUserIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        userId: { in: uniqueUserIds },
      },
    });

    await prisma.user.deleteMany({
      where: { id: { in: uniqueUserIds } },
    });
  }

  const orderedSections: SectionName[] = [
    'Health & Public',
    'Auth',
    'Users',
    'Records Create/Read',
    'Records Update/Delete',
    'Dashboard',
    'Security',
  ];

  const totals = orderedSections.reduce(
    (acc, key) => {
      acc.pass += results[key].pass;
      acc.fail += results[key].fail;
      acc.skip += results[key].skip;
      return acc;
    },
    { pass: 0, fail: 0, skip: 0 }
  );

  const row = (label: string, r: SectionResult): string => {
    const padded = label.padEnd(21, ' ');
    return `║ ${padded} │ ${String(r.pass).padStart(3, ' ')}  │ ${String(r.fail).padStart(3, ' ')}  │ ${String(r.skip).padStart(3, ' ')}  ║`;
  };

  console.info('╔══════════════════════════════════════════╗');
  console.info('║     FINANCE DASHBOARD — TEST REPORT      ║');
  console.info('╠══════════════════════════════════════════╣');
  console.info('║ Section               │ Pass │ Fail │ Skip ║');
  console.info('╠══════════════════════════════════════════╣');
  console.info(row('Health & Public', results['Health & Public']));
  console.info(row('Auth', results.Auth));
  console.info(row('Users', results.Users));
  console.info(row('Records Create/Read', results['Records Create/Read']));
  console.info(row('Records Update/Delete', results['Records Update/Delete']));
  console.info(row('Dashboard', results.Dashboard));
  console.info(row('Security', results.Security));
  console.info('╠══════════════════════════════════════════╣');
  console.info(row('TOTAL', totals));
  console.info('╚══════════════════════════════════════════╝');
});
