"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// tests/dashboard.test.ts
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../src/app");
const testSetup_1 = require("./helpers/testSetup");
const prismaClient_1 = require("../src/utils/prismaClient");
// CLEANUP RULE: Track IDs of all created resources
const createdRecordIds = [];
describe('Dashboard Module', () => {
    afterAll(async () => {
        // Hard delete all records created in this file
        await prismaClient_1.prisma.financialRecord.deleteMany({
            where: { id: { in: createdRecordIds } },
        });
    });
    describe('GET /dashboard/summary', () => {
        it('should return 200 for VIEWER (explicitly allowed)', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/summary')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should return totalIncome as string', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/summary')
                .set('Authorization', `Bearer ${token}`);
            expect(typeof res.body.data.totalIncome).toBe('string');
            expect(typeof res.body.data.totalExpenses).toBe('string');
            expect(typeof res.body.data.netBalance).toBe('string');
        });
        it('should have netBalance = totalIncome - totalExpenses', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/summary')
                .set('Authorization', `Bearer ${token}`);
            const totalIncome = parseFloat(res.body.data.totalIncome);
            const totalExpenses = parseFloat(res.body.data.totalExpenses);
            const netBalance = parseFloat(res.body.data.netBalance);
            expect(netBalance).toBeCloseTo(totalIncome - totalExpenses, 2);
        });
    });
    describe('GET /dashboard/by-category', () => {
        it('should return seeded categories', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/by-category')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
            // Check for known seeded categories
            const categories = res.body.data.map((c) => c.category);
            expect(categories).toContain('salary');
        });
    });
    describe('GET /dashboard/trends', () => {
        it('should return exactly 12 periods for monthly granularity', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/trends?granularity=monthly')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.granularity).toBe('monthly');
            expect(res.body.data.data.length).toBe(12);
        });
        it('should have no gaps in monthly data', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/trends?granularity=monthly')
                .set('Authorization', `Bearer ${token}`);
            const year = new Date().getFullYear();
            const expectedPeriods = Array.from({ length: 12 }, (_, i) => {
                const month = String(i + 1).padStart(2, '0');
                return `${year}-${month}`;
            });
            const actualPeriods = res.body.data.data.map((d) => d.period);
            expect(actualPeriods).toEqual(expectedPeriods);
        });
        it('should return data for weekly granularity', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/trends?granularity=weekly')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.granularity).toBe('weekly');
            expect(res.body.data.data.length).toBe(12);
        });
        it('should return 400 for invalid granularity', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/trends?granularity=invalid')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });
    describe('GET /dashboard/recent', () => {
        it('should return max 10 records', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/recent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.data.length).toBeLessThanOrEqual(10);
        });
        it('should not include deleted records', async () => {
            const adminToken = await (0, testSetup_1.getAdminToken)();
            const record = await (0, testSetup_1.createTestRecord)(adminToken, {
                category: 'recent-test',
                date: new Date().toISOString().split('T')[0],
            });
            createdRecordIds.push(record.id);
            // Delete the record
            await (0, supertest_1.default)(app_1.app)
                .delete(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            // Recent should not include it
            const viewerToken = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/recent')
                .set('Authorization', `Bearer ${viewerToken}`);
            const ids = res.body.data.data.map((r) => r.id);
            expect(ids).not.toContain(record.id);
        });
        it('should be ordered by date desc', async () => {
            const token = await (0, testSetup_1.getViewerToken)();
            const res = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/recent')
                .set('Authorization', `Bearer ${token}`);
            const dates = res.body.data.data.map((r) => new Date(r.date));
            for (let i = 1; i < dates.length; i++) {
                expect(dates[i - 1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
            }
        });
    });
    describe('Dashboard data consistency', () => {
        it('should exclude deleted records from summary', async () => {
            const adminToken = await (0, testSetup_1.getAdminToken)();
            const viewerToken = await (0, testSetup_1.getViewerToken)();
            // Get initial summary
            const initialRes = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/summary')
                .set('Authorization', `Bearer ${viewerToken}`);
            const initialTotal = parseFloat(initialRes.body.data.totalIncome);
            // Create a record
            const record = await (0, testSetup_1.createTestRecord)(adminToken, {
                amount: 9999,
                type: 'INCOME',
                category: 'consistency-test',
            });
            createdRecordIds.push(record.id);
            // Verify it appears in summary
            const withRecordRes = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/summary')
                .set('Authorization', `Bearer ${viewerToken}`);
            const withRecordTotal = parseFloat(withRecordRes.body.data.totalIncome);
            expect(withRecordTotal).toBeGreaterThan(initialTotal);
            // Delete the record
            await (0, supertest_1.default)(app_1.app)
                .delete(`/api/v1/records/${record.id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            // Verify it's excluded from summary
            const afterDeleteRes = await (0, supertest_1.default)(app_1.app)
                .get('/api/v1/dashboard/summary')
                .set('Authorization', `Bearer ${viewerToken}`);
            const afterDeleteTotal = parseFloat(afterDeleteRes.body.data.totalIncome);
            expect(afterDeleteTotal).toBeCloseTo(initialTotal, 2);
        });
    });
});
//# sourceMappingURL=dashboard.test.js.map