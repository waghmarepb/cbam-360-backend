import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import ReportingPeriod, { Quarter, ReportingStatus } from '../models/ReportingPeriod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// All routes require authentication
router.use(authenticate);

// @route   GET /api/reporting-periods
// @desc    Get all reporting periods for current organisation
// @access  Private
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { year, status } = req.query;
    const orgId = req.user?.organisation;

    const filter: Record<string, unknown> = { organisation: orgId };
    
    if (year) {
      filter.year = Number(year);
    }
    
    if (status) {
      filter.status = status;
    }

    const periods = await ReportingPeriod.find(filter)
      .sort({ year: -1, quarter: -1 })
      .populate('submittedBy', 'firstName lastName email');

    res.json({
      success: true,
      data: periods
    });
  } catch (error) {
    console.error('Get reporting periods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reporting periods'
    });
  }
});

// @route   GET /api/reporting-periods/current
// @desc    Get current active reporting period
// @access  Private
router.get('/current', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organisation;
    
    // Find the most recent non-submitted period, or create Q1 of current year
    let period = await ReportingPeriod.findOne({
      organisation: orgId,
      status: { $in: [ReportingStatus.DRAFT, ReportingStatus.IN_PROGRESS] }
    }).sort({ year: -1, quarter: -1 });

    if (!period) {
      // Get the latest period to suggest next one
      const latestPeriod = await ReportingPeriod.findOne({ organisation: orgId })
        .sort({ year: -1, quarter: -1 });

      res.json({
        success: true,
        data: null,
        suggestion: latestPeriod ? getNextPeriod(latestPeriod.year, latestPeriod.quarter) : {
          year: new Date().getFullYear(),
          quarter: getCurrentQuarter()
        }
      });
      return;
    }

    res.json({
      success: true,
      data: period
    });
  } catch (error) {
    console.error('Get current period error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current reporting period'
    });
  }
});

// @route   GET /api/reporting-periods/:id
// @desc    Get reporting period by ID
// @access  Private
router.get(
  '/:id',
  param('id').isMongoId().withMessage('Invalid period ID'),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array()
        });
        return;
      }

      const period = await ReportingPeriod.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation
      }).populate('submittedBy', 'firstName lastName email');

      if (!period) {
        res.status(404).json({
          success: false,
          message: 'Reporting period not found'
        });
        return;
      }

      res.json({
        success: true,
        data: period
      });
    } catch (error) {
      console.error('Get period error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reporting period'
      });
    }
  }
);

// @route   POST /api/reporting-periods
// @desc    Create new reporting period
// @access  Private (Admin, Manager)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    body('year')
      .isInt({ min: 2023, max: 2100 })
      .withMessage('Year must be between 2023 and 2100'),
    body('quarter')
      .isIn(Object.values(Quarter))
      .withMessage('Quarter must be Q1, Q2, Q3, or Q4'),
    body('notes').optional().trim()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { year, quarter, notes } = req.body;
      const orgId = req.user?.organisation;

      // Check if period already exists
      const existing = await ReportingPeriod.findOne({
        organisation: orgId,
        year,
        quarter
      });

      if (existing) {
        res.status(400).json({
          success: false,
          message: `Reporting period ${quarter} ${year} already exists`
        });
        return;
      }

      const period = await ReportingPeriod.create({
        organisation: orgId,
        year,
        quarter,
        notes,
        status: ReportingStatus.DRAFT
      });

      res.status(201).json({
        success: true,
        message: 'Reporting period created successfully',
        data: period
      });
    } catch (error) {
      console.error('Create period error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create reporting period'
      });
    }
  }
);

// @route   PUT /api/reporting-periods/:id
// @desc    Update reporting period
// @access  Private (Admin, Manager)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    param('id').isMongoId().withMessage('Invalid period ID'),
    body('status').optional().isIn(Object.values(ReportingStatus)),
    body('notes').optional().trim()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array()
        });
        return;
      }

      const updateData: Record<string, unknown> = { ...req.body };

      // If status is being set to submitted, record submission details
      if (req.body.status === ReportingStatus.SUBMITTED) {
        updateData.submittedAt = new Date();
        updateData.submittedBy = req.user?._id;
      }

      const period = await ReportingPeriod.findOneAndUpdate(
        { _id: req.params.id, organisation: req.user?.organisation },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!period) {
        res.status(404).json({
          success: false,
          message: 'Reporting period not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Reporting period updated successfully',
        data: period
      });
    } catch (error) {
      console.error('Update period error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update reporting period'
      });
    }
  }
);

// @route   DELETE /api/reporting-periods/:id
// @desc    Delete reporting period (only if draft)
// @access  Private (Admin)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  param('id').isMongoId().withMessage('Invalid period ID'),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array()
        });
        return;
      }

      const period = await ReportingPeriod.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation
      });

      if (!period) {
        res.status(404).json({
          success: false,
          message: 'Reporting period not found'
        });
        return;
      }

      if (period.status !== ReportingStatus.DRAFT) {
        res.status(400).json({
          success: false,
          message: 'Only draft periods can be deleted'
        });
        return;
      }

      await period.deleteOne();

      res.json({
        success: true,
        message: 'Reporting period deleted successfully'
      });
    } catch (error) {
      console.error('Delete period error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete reporting period'
      });
    }
  }
);

// Helper functions
function getCurrentQuarter(): Quarter {
  const month = new Date().getMonth();
  if (month < 3) return Quarter.Q1;
  if (month < 6) return Quarter.Q2;
  if (month < 9) return Quarter.Q3;
  return Quarter.Q4;
}

function getNextPeriod(year: number, quarter: Quarter): { year: number; quarter: Quarter } {
  const quarters = [Quarter.Q1, Quarter.Q2, Quarter.Q3, Quarter.Q4];
  const currentIndex = quarters.indexOf(quarter);
  
  if (currentIndex === 3) {
    return { year: year + 1, quarter: Quarter.Q1 };
  }
  return { year, quarter: quarters[currentIndex + 1] };
}

export default router;

