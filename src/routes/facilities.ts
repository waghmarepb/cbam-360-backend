import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import Facility from '../models/Facility';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// All routes require authentication
router.use(authenticate);

// @route   GET /api/facilities
// @desc    Get all facilities for current organisation
// @access  Private
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;
    const orgId = req.user?.organisation;

    const filter: Record<string, unknown> = { organisation: orgId };
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { facilityCode: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [facilities, total] = await Promise.all([
      Facility.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Facility.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: facilities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get facilities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch facilities'
    });
  }
});

// @route   GET /api/facilities/:id
// @desc    Get facility by ID
// @access  Private
router.get(
  '/:id',
  param('id').isMongoId().withMessage('Invalid facility ID'),
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

      const facility = await Facility.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation
      });

      if (!facility) {
        res.status(404).json({
          success: false,
          message: 'Facility not found'
        });
        return;
      }

      res.json({
        success: true,
        data: facility
      });
    } catch (error) {
      console.error('Get facility error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch facility'
      });
    }
  }
);

// @route   POST /api/facilities
// @desc    Create new facility
// @access  Private (Admin, Manager)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    body('name').trim().notEmpty().withMessage('Facility name is required'),
    body('facilityCode').optional().trim(),
    body('description').optional().trim(),
    body('address.street').trim().notEmpty().withMessage('Street is required'),
    body('address.city').trim().notEmpty().withMessage('City is required'),
    body('address.postalCode').trim().notEmpty().withMessage('Postal code is required'),
    body('address.country').trim().notEmpty().withMessage('Country is required'),
    body('address.countryCode').isLength({ min: 2, max: 2 }).withMessage('Country code must be 2 characters')
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

      const facility = await Facility.create({
        ...req.body,
        organisation: req.user?.organisation
      });

      res.status(201).json({
        success: true,
        message: 'Facility created successfully',
        data: facility
      });
    } catch (error) {
      console.error('Create facility error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create facility'
      });
    }
  }
);

// @route   PUT /api/facilities/:id
// @desc    Update facility
// @access  Private (Admin, Manager)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    param('id').isMongoId().withMessage('Invalid facility ID'),
    body('name').optional().trim().notEmpty(),
    body('facilityCode').optional().trim(),
    body('description').optional().trim(),
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
          errors: errors.array()
        });
        return;
      }

      const facility = await Facility.findOneAndUpdate(
        { _id: req.params.id, organisation: req.user?.organisation },
        { $set: req.body },
        { new: true, runValidators: true }
      );

      if (!facility) {
        res.status(404).json({
          success: false,
          message: 'Facility not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Facility updated successfully',
        data: facility
      });
    } catch (error) {
      console.error('Update facility error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update facility'
      });
    }
  }
);

// @route   DELETE /api/facilities/:id
// @desc    Delete (deactivate) facility
// @access  Private (Admin)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  param('id').isMongoId().withMessage('Invalid facility ID'),
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

      const facility = await Facility.findOneAndUpdate(
        { _id: req.params.id, organisation: req.user?.organisation },
        { isActive: false },
        { new: true }
      );

      if (!facility) {
        res.status(404).json({
          success: false,
          message: 'Facility not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Facility deleted successfully'
      });
    } catch (error) {
      console.error('Delete facility error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete facility'
      });
    }
  }
);

export default router;

