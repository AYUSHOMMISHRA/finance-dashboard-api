"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// tests/records.test.ts
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../src/app");
const testSetup_1 = require("./helpers/testSetup");
const prismaClient_1 = require("../src/utils/prismaClient");
// CLEANUP RULE: Track IDs of all created resources
const createdRecordIds = [];
describe('Records Module', () => {
    afterAll(async () => {
        // Hard delete all records created in this file
        await prismaClient_1.prisma.financialRecord.deleteMany({
            where: { id: { in: createdRecordIds } },
        });
    });
    describe('POST /records', () => {
        it('should create record as ADMIN and return 201 with string amount', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${token}`)
                .send({
                amount: 1500.5,
                type: 'INCOME',
                category: 'test-salary',
                date: new Date().toISOString().split('T')[0],
                notes: 'Test record',
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(typeof res.body.data.amount).toBe('string');
            expect(res.body.data.amount).toBe('1500.50');
            createdRecordIds.push(res.body.data.id);
        });
        it('should return 403 for ANALYST', async () => {
            const token = await (0, testSetup_1.getAnalystToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${token}`)
                .send({
                amount: 1000,
                type: 'INCOME',
                category: 'test',
                date: new Date().toISOString().split('T')[0],
            });
            expect(res.status).toBe(403);
        });
        it('should return 403 for VIEWER', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${token}`)
                .send({
                amount: 1000,
                type: 'INCOME',
                category: 'test',
                date: new Date().toISOString().split('T')[0],
            });
            expect(res.status).toBe(403);
        });
        it('should return 400 for negative amount', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${token}`)
                .send({
                amount: -100,
                type: 'INCOME',
                category: 'test',
                date: new Date().toISOString().split('T')[0],
            });
            expect(res.status).toBe(400);
            expect(res.body.error.details[0].field).toBe('amount');
        });
        it('should return 400 for future date', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${token}`)
                .send({
                amount: 1000,
                type: 'INCOME',
                category: 'test',
                date: futureDate.toISOString().split('T')[0],
            });
            expect(res.status).toBe(400);
            expect(res.body.error.details[0].field).toBe('date');
        });
        it('should return 400 for 3 decimal places', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${token}`)
                .send({
                amount: 100.123,
                type: 'INCOME',
                category: 'test',
                date: new Date().toISOString().split('T')[0],
            });
            expect(res.status).toBe(400);
        });
        it('should return 400 for malformed JSON', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${token}`)
                .set('Content-Type', 'application/json')
                .send('{"invalid json');
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('MALFORMED_JSON');
        });
    });
    describe('GET /records', () => {
        it('should return 200 for ANALYST with pagination meta', async () => {
            const token = await (0, testSetup_1.getAnalystToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/records')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.meta.totalPages).toBeDefined();
        });
        it('should return 403 for VIEWER', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/records')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });
        it('should filter by type=INCOME', async () => {
            const token = await (0, testSetup_1.getAnalystToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/records?type=INCOME')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            res.body.data.forEach((record) => {
                expect(record.type).toBe('INCOME');
            });
        });
        it('should search in notes and category', async () => {
            const adminToken = await (0, testSetup_1.getAdminToken)();
            // Create a record with specific category
            const record = await (0, testSetup_1.createTestRecord)(adminToken, {
                category: 'unique-search-category',
                notes: 'searchable note',
            });
            createdRecordIds.push(record.id);
            const analystToken = await (0, testSetup_1.getAnalystToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/records?search=unique-search')
                .set('Authorization', `Bearer ${analystToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThan(0);
        });
        it('should filter by date range', async () => {
            const token = await (0, testSetup_1.getAnalystToken)();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
            const endDate = new Date();
            const res = await (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/records?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
        it('should return 400 when startDate > endDate', async () => {
            const token = await (0, testSetup_1.getAnalystToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/records?startDate=2025-01-01&endDate=2024-01-01')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });
    describe('PATCH /records/:id', () => {
        it('should update record as ADMIN', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const record = await (0, testSetup_1.createTestRecord)(token, { category: 'patch-test' });
            createdRecordIds.push(record.id);
            const res = await (0, supertest_1.default)(app_1.app)
                .patch(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                amount: 2000,
                notes: 'Updated notes',
            });
            expect(res.status).toBe(200);
            expect(res.body.data.amount).toBe('2000.00');
            expect(res.body.data.notes).toBe('Updated notes');
        });
        it('should clear notes with null', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const record = await (0, testSetup_1.createTestRecord)(token, { notes: 'Will be cleared' });
            createdRecordIds.push(record.id);
            const res = await (0, supertest_1.default)(app_1.app)
                .patch(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ notes: null });
            expect(res.status).toBe(200);
            expect(res.body.data.notes).toBeNull();
        });
        it('should return 403 for ANALYST', async () => {
            const adminToken = await (0, testSetup_1.getAdminToken)();
            const record = await (0, testSetup_1.createTestRecord)(adminToken);
            createdRecordIds.push(record.id);
            const analystToken = await (0, testSetup_1.getAnalystToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .patch(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${analystToken}`)
                .send({ amount: 2000 });
            expect(res.status).toBe(403);
        });
        it('should return 404 for soft-deleted record', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const record = await (0, testSetup_1.createTestRecord)(token);
            createdRecordIds.push(record.id);
            // Soft delete the record
            await (0, supertest_1.default)(app_1.app)
                .delete(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${token}`);
            // Try to update it
            const res = await (0, supertest_1.default)(app_1.app)
                .patch(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ amount: 2000 });
            expect(res.status).toBe(404);
        });
    });
    describe('DELETE /records/:id', () => {
        it('should soft delete record as ADMIN', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const record = await (0, testSetup_1.createTestRecord)(token);
            createdRecordIds.push(record.id);
            const res = await (0, supertest_1.default)(app_1.app)
                .delete(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.message).toBe('Record deleted successfully');
        });
        it('should return 404 when getting deleted record', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const record = await (0, testSetup_1.createTestRecord)(token);
            createdRecordIds.push(record.id);
            // Delete the record
            await (0, supertest_1.default)(app_1.app)
                .delete(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${token}`);
            // Try to get it
            const res = await (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should return 404 for double-delete', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const record = await (0, testSetup_1.createTestRecord)(token);
            createdRecordIds.push(record.id);
            // First delete
            await (0, supertest_1.default)(app_1.app)
                .delete(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${token}`);
            // Second delete
            const res = await (0, supertest_1.default)(app_1.app)
                .delete(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
        it('should exclude deleted records from list', async () => {
            const token = await (0, testSetup_1.getAdminToken)();
            const record = await (0, testSetup_1.createTestRecord)(token, { category: 'delete-test' });
            createdRecordIds.push(record.id);
            // Delete the record
            await (0, supertest_1.default)(app_1.app)
                .delete(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${token}`);
            // List should not include it
            const analystToken = await (0, testSetup_1.getAnalystToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/records?search=delete-test')
                .set('Authorization', `Bearer ${analystToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(0);
        });
    });
});
//# sourceMappingURL=records.test.js.map