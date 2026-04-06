"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// tests/auth.test.ts
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../src/app");
const testSetup_1 = require("./helpers/testSetup");
const prismaClient_1 = require("../src/utils/prismaClient");
// CLEANUP RULE: Track IDs of all created resources
const createdUserIds = [];
describe('Auth Module', () => {
    afterAll(async () => {
        // Delete registered test users
        await prismaClient_1.prisma.user.deleteMany({
            where: { id: { in: createdUserIds } },
        });
    });
    describe('POST /auth/login', () => {
        it('should login valid admin and return 200 with token', async () => {
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/auth/login')
                .send({ email: 'admin@finance.com', password: 'Admin@123' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.user.role).toBe('ADMIN');
        });
        it('should not have password in response', async () => {
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/auth/login')
                .send({ email: 'admin@finance.com', password: 'Admin@123' });
            expect(res.body.data.user.password).toBeUndefined();
        });
        it('should return 401 for wrong password', async () => {
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/auth/login')
                .send({ email: 'admin@finance.com', password: 'WrongPassword123' });
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toBe('Invalid email or password');
        });
        it('should return 401 for wrong email with identical message', async () => {
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/auth/login')
                .send({ email: 'nonexistent@finance.com', password: 'Admin@123' });
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toBe('Invalid email or password');
        });
        it('should normalize email case and login successfully', async () => {
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/auth/login')
                .send({ email: 'Admin@Finance.COM', password: 'Admin@123' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should return 403 for inactive user', async () => {
            // Create inactive user
            const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
            const inactiveUser = await prismaClient_1.prisma.user.create({
                data: {
                    name: 'Inactive User',
                    email: 'inactive@test.com',
                    password: await bcrypt.hash('Inactive@123', 12),
                    role: 'VIEWER',
                    status: 'INACTIVE',
                },
            });
            createdUserIds.push(inactiveUser.id);
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/auth/login')
                .send({ email: 'inactive@test.com', password: 'Inactive@123' });
            expect(res.status).toBe(403);
            expect(res.body.error.message).toContain('deactivated');
        });
    });
    describe('GET /auth/me', () => {
        it('should return 401 without token', async () => {
            const res = await (0, supertest_1.default)(app_1.app).get('/api/v1/auth/me');
            expect(res.status).toBe(401);
        });
        it('should return 200 with user data and no password', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.user.email).toBe('admin@finance.com');
            expect(res.body.data.user.password).toBeUndefined();
        });
        it('should return 401 for malformed token', async () => {
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/auth/me')
                .set('Authorization', 'Bearer invalid-token');
            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe('INVALID_TOKEN');
        });
        it('should return 401 for empty Bearer token', async () => {
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/auth/me')
                .set('Authorization', 'Bearer ');
            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe('UNAUTHORIZED');
        });
    });
    describe('POST /auth/register', () => {
        it('should allow ADMIN to register new user', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const res = await (0, supertest_1.default)(app_1.app)
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
            const token = await (0, testSetup_1.getAnalystToken)();
            const res = await (0, supertest_1.default)(app_1.app)
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
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
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
            const token = await (0, testSetup_1.getAdminToken)();
            const res = await (0, supertest_1.default)(app_1.app)
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
            const token = await (0, testSetup_1.getAdminToken)();
            const res = await (0, supertest_1.default)(app_1.app)
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
//# sourceMappingURL=auth.test.js.map