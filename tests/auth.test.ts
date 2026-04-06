// tests/auth.test.ts
import request from 'supertest';
import { app } from '../src/app';
import { getAdminToken, getAnalystToken, getViewerToken } from './helpers/testSetup';
import { prisma } from '../src/utils/prismaClient';

// CLEANUP RULE: Track IDs of all created resources
const createdUserIds: string[] = [];

describe('Auth Module', () => {
  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { userId: { in: createdUserIds } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  });

  describe('POST /auth/login', () => {
    it('should login valid admin and return 200 with token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@finance.com', password: 'Admin@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('ADMIN');
    });

    it('should not have password in response', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@finance.com', password: 'Admin@123' });

      expect(res.body.data.user.password).toBeUndefined();
    });

    it('should return 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@finance.com', password: 'WrongPassword123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('should return 401 for wrong email with identical message', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@finance.com', password: 'Admin@123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('should normalize email case and login successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'Admin@Finance.COM', password: 'Admin@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 for inactive user', async () => {
      // Create inactive user
      const bcrypt = await import('bcryptjs');
      const inactiveUser = await prisma.user.create({
        data: {
          name: 'Inactive User',
          email: 'inactive@test.com',
          password: await bcrypt.hash('Inactive@123', 12),
          role: 'VIEWER',
          status: 'INACTIVE',
        },
      });
      createdUserIds.push(inactiveUser.id);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'inactive@test.com', password: 'Inactive@123' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('deactivated');
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 200 with user data and no password', async () => {
      const token = await getAdminToken();
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('admin@finance.com');
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('should return 401 for malformed token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should return 401 for empty Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer ');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /auth/register', () => {
    it('should allow ADMIN to register new user', async () => {
      const token = await getAdminToken();
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test User',
          email: 'test-register@example.com',
          password: 'TestPass123',
          role: 'VIEWER',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test-register@example.com');
      createdUserIds.push(res.body.data.user.id);
    });

    it('should return 403 for ANALYST', async () => {
      const token = await getAnalystToken();
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test User',
          email: 'test-analyst@example.com',
          password: 'TestPass123',
          role: 'VIEWER',
        });

      expect(res.status).toBe(403);
    });

    it('should return 403 for VIEWER', async () => {
      const token = await getViewerToken();
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test User',
          email: 'test-viewer@example.com',
          password: 'TestPass123',
          role: 'VIEWER',
        });

      expect(res.status).toBe(403);
    });

    it('should return 400 for password without uppercase', async () => {
      const token = await getAdminToken();
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test User',
          email: 'test-pass@example.com',
          password: 'lowercase123',
          role: 'VIEWER',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate email', async () => {
      const token = await getAdminToken();
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Duplicate User',
          email: 'admin@finance.com',
          password: 'TestPass123',
          role: 'VIEWER',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_ENTRY');
    });
  });
});
