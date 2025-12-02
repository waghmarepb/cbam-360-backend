import { Router, Response } from 'express';
import { query, validationResult } from 'express-validator';
import AuditLog, { AuditAction, AuditResource } from '../models/AuditLog';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.ADMIN, UserRole.MANAGER));

// @route   GET /api/audit
// @desc    Get audit logs
// @access  Private (Admin, Manager)
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('action').optional().isIn(Object.values(AuditAction)),
    query('resource').optional().isIn(Object.values(AuditResource)),
    query('userId').optional().isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {
        organisation: req.user?.organisation
      };

      if (req.query.action) filter.action = req.query.action;
      if (req.query.resource) filter.resource = req.query.resource;
      if (req.query.userId) filter.user = req.query.userId;

      if (req.query.startDate || req.query.endDate) {
        filter.createdAt = {};
        if (req.query.startDate) {
          (filter.createdAt as Record<string, Date>).$gte = new Date(req.query.startDate as string);
        }
        if (req.query.endDate) {
          (filter.createdAt as Record<string, Date>).$lte = new Date(req.query.endDate as string);
        }
      }

      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .populate('user', 'firstName lastName email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        AuditLog.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Audit log error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
    }
  }
);

// @route   GET /api/audit/summary
// @desc    Get audit log summary/stats
// @access  Private (Admin, Manager)
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organisation;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [actionStats, resourceStats, recentActivity, totalLogs] = await Promise.all([
      // Actions breakdown
      AuditLog.aggregate([
        { $match: { organisation: orgId, createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Resources breakdown
      AuditLog.aggregate([
        { $match: { organisation: orgId, createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$resource', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Daily activity (last 30 days)
      AuditLog.aggregate([
        { $match: { organisation: orgId, createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Total logs count
      AuditLog.countDocuments({ organisation: orgId })
    ]);

    res.json({
      success: true,
      data: {
        totalLogs,
        last30Days: {
          actions: actionStats.map(a => ({ action: a._id, count: a.count })),
          resources: resourceStats.map(r => ({ resource: r._id, count: r.count })),
          dailyActivity: recentActivity.map(d => ({ date: d._id, count: d.count }))
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
});

// @route   GET /api/audit/actions
// @desc    Get list of available actions
// @access  Private (Admin, Manager)
router.get('/actions', (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: Object.values(AuditAction)
  });
});

// @route   GET /api/audit/resources
// @desc    Get list of available resources
// @access  Private (Admin, Manager)
router.get('/resources', (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: Object.values(AuditResource)
  });
});

export default router;

