// tests/helpers/testSetup.ts
import request from 'supertest';
import { app } from '../../src/app';

export async function getAdminToken(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@finance.com', password: 'Admin@123' });
  return res.body.data.token;
}

export async function getAnalystToken(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'analyst@finance.com', password: 'Analyst@123' });
  return res.body.data.token;
}

export async function getViewerToken(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'viewer@finance.com', password: 'Viewer@123' });
  return res.body.data.token;
}

interface CreateRecordOverrides {
  amount?: number;
  type?: 'INCOME' | 'EXPENSE';
  category?: string;
  date?: string;
  notes?: string;
}

export async function createTestRecord(
  token: string,
  overrides: CreateRecordOverrides = {}
): Promise<{
  id: string;
  amount: string;
  type: string;
  category: string;
  date: string;
  notes: string | null;
}> {
  const defaultData = {
    amount: 1000,
    type: 'INCOME' as const,
    category: 'test-category',
    date: new Date().toISOString().split('T')[0],
    notes: 'Test record',
  };

  const res = await request(app)
    .post('/api/v1/records')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...defaultData, ...overrides });

  return res.body.data;
}
