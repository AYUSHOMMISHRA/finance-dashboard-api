"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = globalSetup;
// tests/globalSetup.ts
require("dotenv/config");
// ← dotenv MUST be loaded first. process.env.TEST_DATABASE_URL
//   is undefined without this in the globalSetup process.
const child_process_1 = require("child_process");
async function globalSetup() {
    if (!process.env.TEST_DATABASE_URL) {
        throw new Error('TEST_DATABASE_URL is not set.\n' +
            'Never run migrations against production database.');
    }
    const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL };
    // Apply migrations to test DB (non-interactive)
    (0, child_process_1.execSync)('npx prisma migrate deploy', { stdio: 'inherit', env });
    // Seed test users so login helpers work across all test files
    // Use npx ts-node to guarantee local node_modules resolution
    // even in CI environments where ts-node may not be in PATH
    (0, child_process_1.execSync)('npx ts-node prisma/seed.ts', { stdio: 'inherit', env });
    console.info('[globalSetup] Test database ready.');
}
//# sourceMappingURL=globalSetup.js.map