import { Router, Response, Request } from 'express';
import { query, param, validationResult } from 'express-validator';
import CNCode, { CBAMCategory } from '../models/CNCode';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// @route   GET /api/cn-codes
// @desc    Get all CN codes with optional filtering
// @access  Private
router.get(
  '/',
  [
    query('search').optional().trim(),
    query('category').optional().isIn(Object.values(CBAMCategory)),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  async (req: Request, res: Response) => {
    try {
      const { search, category, page = 1, limit = 50 } = req.query;

      const filter: Record<string, unknown> = { cbamApplicable: true };

      if (category) {
        filter.category = category;
      }

      if (search) {
        filter.$or = [
          { code: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [codes, total] = await Promise.all([
        CNCode.find(filter)
          .sort({ code: 1 })
          .skip(skip)
          .limit(Number(limit)),
        CNCode.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: codes,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error('Get CN codes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch CN codes'
      });
    }
  }
);

// @route   GET /api/cn-codes/categories
// @desc    Get all CBAM categories
// @access  Private
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = Object.values(CBAMCategory).map(cat => ({
      value: cat,
      label: cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }));

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// @route   GET /api/cn-codes/:code
// @desc    Get CN code by code
// @access  Private
router.get(
  '/:code',
  param('code').matches(/^\d{8}$/).withMessage('CN code must be 8 digits'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array()
        });
        return;
      }

      const cnCode = await CNCode.findOne({ code: req.params.code });

      if (!cnCode) {
        res.status(404).json({
          success: false,
          message: 'CN code not found'
        });
        return;
      }

      res.json({
        success: true,
        data: cnCode
      });
    } catch (error) {
      console.error('Get CN code error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch CN code'
      });
    }
  }
);

// @route   GET /api/cn-codes/:code/validate
// @desc    Validate if CN code is CBAM applicable
// @access  Private
router.get(
  '/:code/validate',
  param('code').matches(/^\d{8}$/).withMessage('CN code must be 8 digits'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array()
        });
        return;
      }

      const cnCode = await CNCode.findOne({ code: req.params.code });

      if (!cnCode) {
        res.json({
          success: true,
          data: {
            valid: false,
            cbamApplicable: false,
            message: 'CN code not found in CBAM registry'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          valid: true,
          cbamApplicable: cnCode.cbamApplicable,
          category: cnCode.category,
          description: cnCode.description,
          unit: cnCode.unit,
          message: cnCode.cbamApplicable 
            ? 'CN code is CBAM applicable' 
            : 'CN code exists but is not CBAM applicable'
        }
      });
    } catch (error) {
      console.error('Validate CN code error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate CN code'
      });
    }
  }
);

export default router;

