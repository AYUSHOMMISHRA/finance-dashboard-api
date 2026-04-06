# Finance Dashboard Backend

![Tests](https://img.shields.io/badge/tests-121%20passed-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Node](https://img.shields.io/badge/node-20%2B-green)

A production-ready backend API for a finance dashboard system with role-based access control, financial record management, and comprehensive analytics. Built with Node.js, TypeScript, Express, PostgreSQL, and Prisma.

## Features

- **Role-Based Access Control (RBAC)**: Three user roles (Viewer, Analyst, Admin) with granular permissions
- **Financial Records Management**: Full CRUD operations with soft delete, filtering, and search
- **Dashboard Analytics**: Summary totals, category breakdowns, and trend analysis
- **Security**: JWT authentication, rate limiting, Helmet headers, CORS protection
- **Audit Logging**: Complete audit trail for all data modifications
- **Input Validation**: Strict Zod validation with detailed error messages
- **API Documentation**: Swagger UI with interactive documentation
- **Testing**: Comprehensive test suite with Jest and Supertest

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Framework | Express.js |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | JWT + bcryptjs |
| Validation | Zod |
| Testing | Jest + Supertest |
| Docs | Swagger UI |
| Security | Helmet, CORS, express-rate-limit |
| Containers | Docker + Docker Compose |

## Quick Start (Docker)

```bash
git clone <repo> && cd finance-dashboard-backend
cp .env.example .env
docker-compose up --build
docker-compose exec api npm run db:seed
```

- API: http://localhost:3000
- Docs: http://localhost:3000/api/v1/docs
- Health: http://localhost:3000/health

## Production Deployment (Railway)

- API: https://zorvyn-finance-dashboard-api.up.railway.app/
- Docs: https://zorvyn-finance-dashboard-api.up.railway.app/api/v1/docs/
- Health: https://zorvyn-finance-dashboard-api.up.railway.app/health

## Manual Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16+

### Installation

```bash
npm install   # also runs 'prisma generate' via postinstall
cp .env.example .env  # fill in values
npm run db:migrate
npm run db:seed
npm run dev
```

**Note**: `npm run db:migrate` uses `prisma migrate dev` (local only). Docker uses `prisma migrate deploy` (non-interactive, production). Never use migrate dev in production environments.

## Seeded Accounts

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| ADMIN   | admin@finance.com   | Admin@123   |
| ANALYST | analyst@finance.com | Analyst@123 |
| VIEWER  | viewer@finance.com  | Viewer@123  |

## API Reference

| Method | Route                  | Roles                  | Description          |
|--------|------------------------|------------------------|----------------------|
| POST   | /auth/login            | Public                 | Login                |
| POST   | /auth/register         | ADMIN                  | Create user          |
| GET    | /auth/me               | Any auth               | Current user         |
| GET    | /users                 | ADMIN                  | List users           |
| GET    | /users/:id             | ADMIN                  | Get user             |
| PATCH  | /users/:id             | ADMIN                  | Update user          |
| DELETE | /users/:id             | ADMIN                  | Deactivate user      |
| POST   | /records               | ADMIN                  | Create record        |
| GET    | /records               | ANALYST, ADMIN         | List records         |
| GET    | /records/:id           | ANALYST, ADMIN         | Get record           |
| PATCH  | /records/:id           | ADMIN                  | Update record        |
| DELETE | /records/:id           | ADMIN                  | Soft delete          |
| GET    | /dashboard/summary     | VIEWER, ANALYST, ADMIN | Totals               |
| GET    | /dashboard/by-category | VIEWER, ANALYST, ADMIN | By category          |
| GET    | /dashboard/trends      | VIEWER, ANALYST, ADMIN | Trends               |
| GET    | /dashboard/recent      | VIEWER, ANALYST, ADMIN | Last 10 records      |
| GET    | /health                | Public                 | Health check         |
| GET    | /api/v1/docs           | Public                 | Swagger UI           |

The `/auth/register` endpoint is protected and requires a valid JWT token with `ADMIN` role.
If accessed without authentication, it correctly returns a `401 Unauthorized` response.
This demonstrates proper role-based access control implementation.

## Postman Import

1. Open Postman
2. Click **Import** → **Upload Files**
3. Select `postman/finance-dashboard.collection.json`
4. Import `postman/finance-dashboard.environment.json` as environment
5. Run the **Login** request first (it auto-saves the token)

## Curl Examples

```bash
# Login and save token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@finance.com","password":"Admin@123"}' | jq -r '.data.token')

# Get dashboard summary
curl http://localhost:3000/api/v1/dashboard/summary \
  -H "Authorization: Bearer $TOKEN"

# Create a record
curl -X POST http://localhost:3000/api/v1/records \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":1500,"type":"INCOME","category":"salary","date":"2025-03-15"}'

# List records with filters
curl "http://localhost:3000/api/v1/records?type=INCOME&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

## Running Tests

```bash
npm test
```

Requires `TEST_DATABASE_URL` in .env (separate test database). globalSetup migrates and seeds the test DB automatically.

### Test Results

Test Suites: 1 passed, 1 total
Tests:       121 passed, 121 total
Time:        ~18s

Covers 121 test cases across auth, users, records, dashboard, and security edge cases including timing-safe login, soft delete enforcement, decimal validation, RBAC on every route, deactivation checks, token expiry, and double-delete protection.

### Test Coverage

- **Auth**: Login, registration, token validation, role-based access
- **Records**: CRUD operations, filtering, soft delete, validation
- **Dashboard**: Summary calculations, trends, recent records

## Architecture Decision Records

| Decision | Rationale |
|----------|-----------|
| PostgreSQL over MongoDB | ACID compliance, native Decimal type for money, SQL joins for complex queries |
| Prisma over TypeORM | Compile-time type safety, excellent migration system, parameterized `$queryRaw` |
| Decimal(12,2) over Float | IEEE 754 floating point errors (0.1 + 0.2 ≠ 0.3) would cause incorrect financial calculations |
| Soft delete | Audit trail compliance, data recovery capability, referential integrity preservation |
| JWT + DB status check | User deactivation takes effect immediately even with valid tokens |
| DUMMY_HASH at 1 round | Prevents timing attacks on login without slowing server startup |
| Helmet route-exempt for Swagger | Helmet's CSP blocks Swagger UI inline scripts; exemption via `originalUrl` check |
| trust proxy before rate limiter | In Docker, all traffic comes from proxy IP; trust proxy enables real client IP detection |
| Rate limiter skip in test | Prevents false 429s in test suite from rapid sequential requests |
| VIEWER dashboard-only access | KPI insights without exposing raw transaction data |
| Category free-form + .trim() | Flexible categorization while preventing "salary" vs "salary " duplicates in groupBy |
| Atomic $transaction for writes | Complete audit trail guaranteed; no partial writes possible |
| Compound index [isDeleted,type,date] | Single index seek vs three separate; critical at 100k+ records |
| X-Request-ID tracing | Instant log lookup from error reports for debugging |
| postinstall: prisma generate | Fresh clone works immediately after npm install |

## Known Limitations

1. **Single currency**: System assumes USD; multi-currency support would require exchange rate tracking
2. **No file uploads**: Receipt attachments not implemented; would need S3 integration
3. **Simple search**: Full-text search uses ILIKE; large datasets would benefit from PostgreSQL tsvector
4. **No real-time updates**: WebSocket/SSE not implemented for live dashboard updates
5. **No connection pooling**: Direct Prisma connections work for this scale; production would use PgBouncer or Prisma Accelerate for high concurrency

## Future Improvements

1. **Multi-tenancy**: Support multiple organizations with data isolation
2. **Advanced analytics**: Forecasting, budget tracking, anomaly detection
3. **Export functionality**: CSV/Excel/PDF export for records and reports
4. **Email notifications**: Alerts for large transactions, budget thresholds
5. **Two-factor authentication**: TOTP for enhanced security
6. **API versioning**: URL versioning for backward compatibility

## Project Structure

```
finance-dashboard-backend/
├── prisma/
│   ├── schema.prisma      # Database schema with enums and indexes
│   └── seed.ts            # Seed data with 3 users and 30 records
├── src/
│   ├── config/
│   │   ├── env.ts         # Environment variable validation with Zod
│   │   └── swagger.ts     # Swagger/OpenAPI specification
│   ├── constants/
│   │   └── auditActions.ts # Centralized audit action constants
│   ├── middlewares/
│   │   ├── authenticate.ts # JWT verification with DB status check
│   │   ├── authorize.ts   # Role-based access control
│   │   ├── errorHandler.ts # Centralized error handling
│   │   └── requestId.ts   # Request tracing with UUID
│   ├── modules/
│   │   ├── auth/          # Authentication module
│   │   ├── users/         # User management module
│   │   ├── records/       # Financial records module
│   │   └── dashboard/     # Analytics module
│   ├── utils/
│   │   ├── AppError.ts    # Custom error class
│   │   ├── catchAsync.ts  # Async error wrapper
│   │   ├── prismaClient.ts # Singleton Prisma client
│   │   ├── response.ts    # Standardized response helpers
│   │   └── serializers.ts # Data serialization utilities
│   ├── types/
│   │   └── express.d.ts   # TypeScript type augmentations
│   ├── app.ts             # Express app configuration
│   └── index.ts           # Server entry point
├── tests/
│   ├── helpers/
│   │   └── testSetup.ts   # Test helper functions
│   ├── auth.test.ts       # Authentication tests
│   ├── records.test.ts    # Records module tests
│   └── dashboard.test.ts  # Dashboard module tests
├── postman/
│   ├── finance-dashboard.collection.json
│   └── finance-dashboard.environment.json
├── docker-entrypoint.sh   # Docker startup script
├── Dockerfile             # Multi-stage Docker build
├── docker-compose.yml     # Docker Compose configuration
└── package.json           # Dependencies and scripts
```

## License

MIT
