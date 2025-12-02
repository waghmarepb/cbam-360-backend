import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Calculation, { CalculationStatus } from '../models/Calculation';
import ValidationResult from '../models/Validation';
import CalculationEngine from '../services/calculationEngine';
import ValidationEngine from '../services/validationEngine';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticate);

// @route   GET /api/calculations
// @desc    Get all calculations for organisation
// @access  Private
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod, status } = req.query;
    const orgId = req.user?.organisation;

    const filter: Record<string, unknown> = { organisation: orgId };
    if (reportingPeriod) filter.reportingPeriod = reportingPeriod;
    if (status) filter.status = status;

    const calculations = await Calculation.find(filter)
      .populate('reportingPeriod', 'year quarter')
      .populate('facility', 'name')
      .populate('calculatedBy', 'firstName lastName')
      .sort({ calculatedAt: -1 });

    res.json({ success: true, data: calculations });
  } catch (error) {
    console.error('Get calculations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch calculations' });
  }
});

// @route   GET /api/calculations/:id
// @desc    Get calculation by ID
// @access  Private
router.get(
  '/:id',
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const calculation = await Calculation.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation
      })
        .populate('reportingPeriod', 'year quarter startDate endDate')
        .populate('facility', 'name address')
        .populate('calculatedBy', 'firstName lastName')
        .populate('products.product', 'name cnCode');

      if (!calculation) {
        res.status(404).json({ success: false, message: 'Calculation not found' });
        return;
      }

      res.json({ success: true, data: calculation });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch calculation' });
    }
  }
);

// @route   POST /api/calculations/run
// @desc    Run calculation for a reporting period
// @access  Private (Admin, Manager)
router.post(
  '/run',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    body('reportingPeriod').isMongoId().withMessage('Valid reporting period required'),
    body('facility').optional().isMongoId()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { reportingPeriod, facility } = req.body;
      const orgId = req.user?.organisation;

      // Check if there's a finalized calculation
      const existing = await Calculation.findOne({
        organisation: orgId,
        reportingPeriod,
        status: CalculationStatus.FINALIZED
      });

      if (existing) {
        res.status(400).json({
          success: false,
          message: 'A finalized calculation already exists for this period'
        });
        return;
      }

      // Run calculation engine
      const engine = new CalculationEngine({
        organisationId: orgId as mongoose.Types.ObjectId,
        reportingPeriodId: new mongoose.Types.ObjectId(reportingPeriod),
        facilityId: facility ? new mongoose.Types.ObjectId(facility) : undefined,
        userId: req.user?._id as mongoose.Types.ObjectId
      });

      const result = await engine.run();

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error
        });
        return;
      }

      res.json({
        success: true,
        message: 'Calculation completed successfully',
        data: result.calculation
      });
    } catch (error) {
      console.error('Run calculation error:', error);
      res.status(500).json({ success: false, message: 'Calculation failed' });
    }
  }
);

// @route   POST /api/calculations/:id/finalize
// @desc    Finalize a calculation
// @access  Private (Admin, Manager)
router.post(
  '/:id/finalize',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const calculation = await Calculation.findOneAndUpdate(
        {
          _id: req.params.id,
          organisation: req.user?.organisation,
          status: { $in: [CalculationStatus.CALCULATED, CalculationStatus.VALIDATED] }
        },
        {
          status: CalculationStatus.FINALIZED,
          finalizedAt: new Date(),
          finalizedBy: req.user?._id
        },
        { new: true }
      );

      if (!calculation) {
        res.status(404).json({
          success: false,
          message: 'Calculation not found or cannot be finalized'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Calculation finalized successfully',
        data: calculation
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to finalize' });
    }
  }
);

// @route   DELETE /api/calculations/:id
// @desc    Delete a calculation (only draft/calculated)
// @access  Private (Admin)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const calculation = await Calculation.findOneAndDelete({
        _id: req.params.id,
        organisation: req.user?.organisation,
        status: { $ne: CalculationStatus.FINALIZED }
      });

      if (!calculation) {
        res.status(404).json({
          success: false,
          message: 'Calculation not found or cannot be deleted'
        });
        return;
      }

      res.json({ success: true, message: 'Calculation deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete' });
    }
  }
);

// ==================== VALIDATION ====================

// @route   GET /api/calculations/validations
// @desc    Get all validations
// @access  Private
router.get('/validations/all', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod } = req.query;
    const filter: Record<string, unknown> = { organisation: req.user?.organisation };
    if (reportingPeriod) filter.reportingPeriod = reportingPeriod;

    const validations = await ValidationResult.find(filter)
      .populate('reportingPeriod', 'year quarter')
      .populate('validatedBy', 'firstName lastName')
      .sort({ validatedAt: -1 });

    res.json({ success: true, data: validations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch validations' });
  }
});

// @route   POST /api/calculations/validate
// @desc    Run validation for a reporting period
// @access  Private (Admin, Manager)
router.post(
  '/validate',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    body('reportingPeriod').isMongoId(),
    body('calculationId').optional().isMongoId()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { reportingPeriod, calculationId } = req.body;
      const orgId = req.user?.organisation;

      const engine = new ValidationEngine({
        organisationId: orgId as mongoose.Types.ObjectId,
        reportingPeriodId: new mongoose.Types.ObjectId(reportingPeriod),
        calculationId: calculationId ? new mongoose.Types.ObjectId(calculationId) : undefined,
        userId: req.user?._id as mongoose.Types.ObjectId
      });

      const result = await engine.run();

      // Update calculation status if validation passed
      if (calculationId && result.status === 'passed') {
        await Calculation.findByIdAndUpdate(calculationId, {
          status: CalculationStatus.VALIDATED
        });
      }

      res.json({
        success: true,
        message: `Validation completed: ${result.status}`,
        data: result
      });
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({ success: false, message: 'Validation failed' });
    }
  }
);

// @route   GET /api/calculations/validations/:id
// @desc    Get validation result by ID
// @access  Private
router.get(
  '/validations/:id',
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const validation = await ValidationResult.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation
      })
        .populate('reportingPeriod', 'year quarter')
        .populate('validatedBy', 'firstName lastName');

      if (!validation) {
        res.status(404).json({ success: false, message: 'Validation not found' });
        return;
      }

      res.json({ success: true, data: validation });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch validation' });
    }
  }
);

export default router;

