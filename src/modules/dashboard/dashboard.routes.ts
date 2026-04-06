// src/modules/dashboard/dashboard.routes.ts
import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

export const dashboardRouter = Router();

// All routes: [authenticate, authorize('VIEWER', 'ANALYST', 'ADMIN')]
// VIEWER accesses ALL dashboard routes — intentional design.
// VIEWERs get KPI insight without raw transaction data access.
dashboardRouter.use(authenticate, authorize('VIEWER', 'ANALYST', 'ADMIN'));

/**
 * @swagger
 * /dashboard/summary:
 *   get:
 *     summary: Get dashboard summary (All authenticated users)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/DashboardSummary'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
dashboardRouter.get('/summary', dashboardController.getSummary);

/**
 * @swagger
 * /dashboard/by-category:
 *   get:
 *     summary: Get totals grouped by category (All authenticated users)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Category breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CategoryItem'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
dashboardRouter.get('/by-category', dashboardController.getByCategory);

/**
 * @swagger
 * /dashboard/trends:
 *   get:
 *     summary: Get income/expense trends (All authenticated users)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [monthly, weekly]
 *           default: monthly
 *     responses:
 *       200:
 *         description: Trends data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     granularity: { type: string }
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TrendPoint'
 *       400:
 *         description: Invalid granularity
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
dashboardRouter.get('/trends', dashboardController.getTrends);

/**
 * @swagger
 * /dashboard/recent:
 *   get:
 *     summary: Get recent 10 records (All authenticated users)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Recent records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FinancialRecord'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
dashboardRouter.get('/recent', dashboardController.getRecent);

// Design choices for Dashboard module:
// - VIEWER role has dashboard-only access for KPI insights
// - No raw transaction data exposed to VIEWERs
// - Summary uses Prisma.Decimal for precise money calculations
// - Trends use raw SQL with gap-filling for complete charts
// - All calculations exclude soft-deleted records
// - Monthly trends show full 12 months, weekly shows last 12 weeks
