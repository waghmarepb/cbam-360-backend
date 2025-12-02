import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import EmissionFactor, { EmissionFactorType } from '../models/EmissionFactor';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// All routes require authentication
router.use(authenticate);

// @route   GET /api/emission-factors
// @desc    Get all emission factors (global + organisation specific)
// @access  Private
router.get(
  '/',
  [
    query('type').optional().isIn(Object.values(EmissionFactorType)),
    query('category').optional().trim(),
    query('countryCode').optional().isLength({ min: 2, max: 2 }),
    query('search').optional().trim(),
    query('includeGlobal').optional().isBoolean()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { type, category, countryCode, search, includeGlobal = 'true' } = req.query;
      const orgId = req.user?.organisation;

      const filter: Record<string, unknown> = {
        isActive: true,
        $or: [
          { organisation: orgId },
          ...(includeGlobal === 'true' ? [{ organisation: null, isDefault: true }] : [])
        ]
      };

      if (type) filter.type = type;
      if (category) filter.category = category;
      if (countryCode) filter.countryCode = (countryCode as string).toUpperCase();

      if (search) {
        filter.$and = [{
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { code: { $regex: search, $options: 'i' } }
          ]
        }];
      }

      const factors = await EmissionFactor.find(filter)
        .sort({ type: 1, name: 1 });

      res.json({
        success: true,
        data: factors
      });
    } catch (error) {
      console.error('Get emission factors error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch emission factors'
      });
    }
  }
);

// @route   GET /api/emission-factors/fuel
// @desc    Get fuel emission factors
// @access  Private
router.get('/fuel', async (req: AuthRequest, res: Response) => {
  try {
    const factors = await EmissionFactor.find({
      type: EmissionFactorType.FUEL,
      isActive: true,
      $or: [
        { organisation: req.user?.organisation },
        { organisation: null, isDefault: true }
      ]
    }).sort({ category: 1, name: 1 });

    // Group by category
    const grouped = factors.reduce((acc, f) => {
      const cat = f.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(f);
      return acc;
    }, {} as Record<string, typeof factors>);

    res.json({
      success: true,
      data: factors,
      grouped
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fuel factors'
    });
  }
});

// @route   GET /api/emission-factors/electricity
// @desc    Get electricity grid emission factors
// @access  Private
router.get('/electricity', async (req: AuthRequest, res: Response) => {
  try {
    const { countryCode } = req.query;

    const filter: Record<string, unknown> = {
      type: EmissionFactorType.ELECTRICITY,
      isActive: true
    };

    if (countryCode) {
      filter.countryCode = (countryCode as string).toUpperCase();
    }

    const factors = await EmissionFactor.find(filter)
      .sort({ countryCode: 1, name: 1 });

    res.json({
      success: true,
      data: factors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch electricity factors'
    });
  }
});

// @route   GET /api/emission-factors/defaults
// @desc    Get CBAM default emission factors
// @access  Private
router.get('/defaults', async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query;

    const filter: Record<string, unknown> = {
      type: EmissionFactorType.DEFAULT,
      isDefault: true,
      isActive: true
    };

    if (category) filter.category = category;

    const factors = await EmissionFactor.find(filter)
      .sort({ category: 1, name: 1 });

    // Group by category
    const grouped = factors.reduce((acc, f) => {
      const cat = f.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(f);
      return acc;
    }, {} as Record<string, typeof factors>);

    res.json({
      success: true,
      data: factors,
      grouped
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch default factors'
    });
  }
});

// @route   GET /api/emission-factors/:id
// @desc    Get emission factor by ID
// @access  Private
router.get(
  '/:id',
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const factor = await EmissionFactor.findById(req.params.id);

      if (!factor) {
        res.status(404).json({
          success: false,
          message: 'Emission factor not found'
        });
        return;
      }

      res.json({
        success: true,
        data: factor
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch emission factor'
      });
    }
  }
);

// @route   POST /api/emission-factors
// @desc    Create custom emission factor
// @access  Private (Admin, Manager)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    body('type').isIn(Object.values(EmissionFactorType)).withMessage('Valid type required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('emissionFactor').isFloat({ min: 0 }).withMessage('Valid emission factor required'),
    body('unit').trim().notEmpty().withMessage('Unit is required'),
    body('sourceUnit').trim().notEmpty().withMessage('Source unit is required'),
    body('source').trim().notEmpty().withMessage('Source is required'),
    body('countryCode').optional().isLength({ min: 2, max: 2 }),
    body('category').optional().trim(),
    body('year').optional().isInt({ min: 2000, max: 2100 })
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

      const factor = await EmissionFactor.create({
        ...req.body,
        organisation: req.user?.organisation,
        isDefault: false
      });

      res.status(201).json({
        success: true,
        message: 'Emission factor created successfully',
        data: factor
      });
    } catch (error) {
      console.error('Create emission factor error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create emission factor'
      });
    }
  }
);

// @route   PUT /api/emission-factors/:id
// @desc    Update emission factor
// @access  Private (Admin, Manager)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('emissionFactor').optional().isFloat({ min: 0 }),
    body('unit').optional().trim().notEmpty(),
    body('source').optional().trim().notEmpty()
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

      // Only allow updating org-specific factors
      const factor = await EmissionFactor.findOneAndUpdate(
        { 
          _id: req.params.id,
          organisation: req.user?.organisation,
          isDefault: false
        },
        { $set: req.body },
        { new: true, runValidators: true }
      );

      if (!factor) {
        res.status(404).json({
          success: false,
          message: 'Emission factor not found or cannot be modified'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Emission factor updated successfully',
        data: factor
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update emission factor'
      });
    }
  }
);

// @route   DELETE /api/emission-factors/:id
// @desc    Delete custom emission factor
// @access  Private (Admin)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      // Only allow deleting org-specific factors
      const factor = await EmissionFactor.findOneAndUpdate(
        {
          _id: req.params.id,
          organisation: req.user?.organisation,
          isDefault: false
        },
        { isActive: false },
        { new: true }
      );

      if (!factor) {
        res.status(404).json({
          success: false,
          message: 'Emission factor not found or cannot be deleted'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Emission factor deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete emission factor'
      });
    }
  }
);

export default router;

