"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminToken = getAdminToken;
exports.getAnalystToken = getAnalystToken;
exports.getViewerToken = getViewerToken;
exports.createTestRecord = createTestRecord;
// tests/helpers/testSetup.ts
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../../src/app");
async function getAdminToken() {
    const res = await (0, supertest_1.default)(app_1.app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@finance.com', password: 'Admin@123' });
    return res.body.data.token;
}
async function getAnalystToken() {
    const res = await (0, supertest_1.default)(app_1.app)
        .post('/api/v1/auth/login')
        .send({ email: 'analyst@finance.com', password: 'Analyst@123' });
    return res.body.data.token;
}
async function getViewerToken() {
    const res = await (0, supertest_1.default)(app_1.app)
        .post('/api/v1/auth/login')
        .send({ email: 'viewer@finance.com', password: 'Viewer@123' });
    return res.body.data.token;
}
async function createTestRecord(token, overrides = {}) {
    const defaultData = {
        amount: 1000,
        type: 'INCOME',
        category: 'test-category',
        date: new Date().toISOString().split('T')[0],
        notes: 'Test record',
    };
    const res = await (0, supertest_1.default)(app_1.app)
        .post('/api/v1/records')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...defaultData, ...overrides });
    return res.body.data;
}
//# sourceMappingURL=testSetup.js.map