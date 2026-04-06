"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// tests/jestSetupEnv.ts
require("dotenv/config");
// CRITICAL — WHY THIS FILE EXISTS:
// Jest globalSetup runs in a SEPARATE process from test workers.
// Any process.env changes made in globalSetup do NOT propagate
// to the worker processes that run test files.
// setupFiles (this file) runs inside EACH worker before any
// imports are evaluated — so prismaClient picks up the right URL.
if (!process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL not set. Add it to .env before running tests.\n' +
        'Tests require a separate test database — never test against production.');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
//# sourceMappingURL=jestSetupEnv.js.map