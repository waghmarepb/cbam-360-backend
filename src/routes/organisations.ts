import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Organisation from '../models/Organisation';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// All routes require authentication
router.use(authenticate);

// @route   GET /api/organisations/current
// @desc    Get current user's organisation
// @access  Private
router.get('/current', async (req: AuthRequest, res: Response) => {
  try {
    const organisation = await Organisation.findById(req.user?.organisation);

    if (!organisation) {
      res.status(404).json({
        success: false,
        message: 'Organisation not found'
      });
      return;
    }

    res.json({
      success: true,
      data: organisation
    });
  } catch (error) {
    console.error('Get organisation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organisation'
    });
  }
});

// @route   PUT /api/organisations/current
// @desc    Update current user's organisation
// @access  Private (Admin, Manager)
router.put(
  '/current',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('registrationNumber').optional().trim(),
    body('vatNumber').optional().trim(),
    body('contactEmail').optional().isEmail().withMessage('Valid email required'),
    body('contactPhone').optional().trim(),
    body('website').optional().trim(),
    body('address.street').optional().trim().notEmpty(),
    body('address.city').optional().trim().notEmpty(),
    body('address.postalCode').optional().trim().notEmpty(),
    body('address.country').optional().trim().notEmpty(),
    body('address.countryCode').optional().isLength({ min: 2, max: 2 })
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

      const organisation = await Organisation.findByIdAndUpdate(
        req.user?.organisation,
        { $set: req.body },
        { new: true, runValidators: true }
      );

      if (!organisation) {
        res.status(404).json({
          success: false,
          message: 'Organisation not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Organisation updated successfully',
        data: organisation
      });
    } catch (error) {
      console.error('Update organisation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update organisation'
      });
    }
  }
);

// @route   GET /api/organisations/stats
// @desc    Get organisation statistics
// @access  Private
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organisation;

    // Import models for counts
    const Facility = (await import('../models/Facility')).default;
    const ReportingPeriod = (await import('../models/ReportingPeriod')).default;
    const Product = (await import('../models/Product')).default;

    const [facilitiesCount, periodsCount, productsCount] = await Promise.all([
      Facility.countDocuments({ organisation: orgId, isActive: true }),
      ReportingPeriod.countDocuments({ organisation: orgId }),
      Product.countDocuments({ organisation: orgId, isActive: true })
    ]);

    res.json({
      success: true,
      data: {
        facilities: facilitiesCount,
        reportingPeriods: periodsCount,
        products: productsCount
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

export default router;

