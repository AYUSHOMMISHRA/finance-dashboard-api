"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = globalTeardown;
// tests/globalTeardown.ts
const client_1 = require("@prisma/client");
async function globalTeardown() {
    const prisma = new client_1.PrismaClient();
    await prisma.$disconnect();
    // Without this Jest hangs after tests complete.
    // --forceExit masks but does not fix the underlying issue.
}
//# sourceMappingURL=globalTeardown.js.map