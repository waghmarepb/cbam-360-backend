import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ElectricityData, FuelData, ProductionData, PrecursorData } from '../models/ActivityData';
import EmissionFactor, { EmissionFactorType } from '../models/EmissionFactor';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

// ==================== ELECTRICITY ====================

// @route   GET /api/activity-data/electricity
// @desc    Get electricity consumption data
// @access  Private
router.get('/electricity', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod, facility, month } = req.query;
    const orgId = req.user?.organisation;

    const filter: Record<string, unknown> = { organisation: orgId };
    if (reportingPeriod) filter.reportingPeriod = reportingPeriod;
    if (facility) filter.facility = facility;
    if (month) filter.month = Number(month);

    const data = await ElectricityData.find(filter)
      .populate('facility', 'name')
      .populate('reportingPeriod', 'year quarter')
      .sort({ year: -1, month: -1 });

    // Calculate totals
    const totals = data.reduce((acc, d) => ({
      gridElectricity: acc.gridElectricity + (d.gridElectricity || 0),
      renewableElectricity: acc.renewableElectricity + (d.renewableElectricity || 0),
      captiveElectricity: acc.captiveElectricity + (d.captiveElectricity || 0),
      totalElectricity: acc.totalElectricity + (d.totalElectricity || 0),
      calculatedEmissions: acc.calculatedEmissions + (d.calculatedEmissions || 0)
    }), {
      gridElectricity: 0,
      renewableElectricity: 0,
      captiveElectricity: 0,
      totalElectricity: 0,
      calculatedEmissions: 0
    });

    res.json({ success: true, data, totals });
  } catch (error) {
    console.error('Get electricity data error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch electricity data' });
  }
});

// @route   POST /api/activity-data/electricity
// @desc    Add electricity consumption data
// @access  Private
router.post(
  '/electricity',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR),
  [
    body('reportingPeriod').isMongoId(),
    body('facility').isMongoId(),
    body('month').isInt({ min: 1, max: 12 }),
    body('year').isInt({ min: 2020, max: 2100 }),
    body('gridElectricity').isFloat({ min: 0 }),
    body('renewableElectricity').optional().isFloat({ min: 0 }),
    body('captiveElectricity').optional().isFloat({ min: 0 }),
    body('gridEmissionFactor').optional().isFloat({ min: 0 }),
    body('captiveEmissionFactor').optional().isFloat({ min: 0 })
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const orgId = req.user?.organisation;
      const { gridElectricity, renewableElectricity = 0, captiveElectricity = 0, gridEmissionFactor, captiveEmissionFactor } = req.body;

      // Calculate emissions
      const gridEF = gridEmissionFactor || 0.716; // Default India EF
      const captiveEF = captiveEmissionFactor || 0.8; // Default DG EF
      const gridEmissions = (gridElectricity / 1000) * gridEF; // Convert kWh to MWh
      const captiveEmissions = (captiveElectricity / 1000) * captiveEF;
      const calculatedEmissions = gridEmissions + captiveEmissions;

      const data = await ElectricityData.create({
        ...req.body,
        organisation: orgId,
        renewableElectricity,
        captiveElectricity,
        gridEmissionFactor: gridEF,
        captiveEmissionFactor: captiveEF,
        calculatedEmissions,
        createdBy: req.user?._id
      });

      res.status(201).json({
        success: true,
        message: 'Electricity data added successfully',
        data
      });
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 11000) {
        res.status(400).json({ success: false, message: 'Data for this month already exists' });
        return;
      }
      console.error('Add electricity data error:', error);
      res.status(500).json({ success: false, message: 'Failed to add electricity data' });
    }
  }
);

// @route   PUT /api/activity-data/electricity/:id
// @desc    Update electricity data
// @access  Private
router.put(
  '/electricity/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { gridElectricity, renewableElectricity = 0, captiveElectricity = 0, gridEmissionFactor, captiveEmissionFactor } = req.body;

      const updateData = { ...req.body, updatedBy: req.user?._id };

      // Recalculate emissions if values changed
      if (gridElectricity !== undefined || captiveElectricity !== undefined) {
        const gridEF = gridEmissionFactor || 0.716;
        const captiveEF = captiveEmissionFactor || 0.8;
        updateData.calculatedEmissions = ((gridElectricity || 0) / 1000) * gridEF + ((captiveElectricity || 0) / 1000) * captiveEF;
      }

      const data = await ElectricityData.findOneAndUpdate(
        { _id: req.params.id, organisation: req.user?.organisation },
        { $set: updateData },
        { new: true }
      );

      if (!data) {
        res.status(404).json({ success: false, message: 'Data not found' });
        return;
      }

      res.json({ success: true, message: 'Updated successfully', data });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update' });
    }
  }
);

// @route   DELETE /api/activity-data/electricity/:id
// @desc    Delete electricity data
// @access  Private (Admin, Manager)
router.delete(
  '/electricity/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await ElectricityData.findOneAndDelete({
        _id: req.params.id,
        organisation: req.user?.organisation
      });

      if (!data) {
        res.status(404).json({ success: false, message: 'Data not found' });
        return;
      }

      res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete' });
    }
  }
);

// ==================== FUEL ====================

// @route   GET /api/activity-data/fuel
router.get('/fuel', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod, facility, month } = req.query;
    const orgId = req.user?.organisation;

    const filter: Record<string, unknown> = { organisation: orgId };
    if (reportingPeriod) filter.reportingPeriod = reportingPeriod;
    if (facility) filter.facility = facility;
    if (month) filter.month = Number(month);

    const data = await FuelData.find(filter)
      .populate('facility', 'name')
      .populate('reportingPeriod', 'year quarter')
      .populate('fuelType', 'name emissionFactor unit')
      .sort({ year: -1, month: -1 });

    const totals = data.reduce((acc, d) => ({
      totalQuantity: acc.totalQuantity + (d.quantity || 0),
      calculatedEmissions: acc.calculatedEmissions + (d.calculatedEmissions || 0)
    }), { totalQuantity: 0, calculatedEmissions: 0 });

    res.json({ success: true, data, totals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch fuel data' });
  }
});

// @route   POST /api/activity-data/fuel
router.post(
  '/fuel',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR),
  [
    body('reportingPeriod').isMongoId(),
    body('facility').isMongoId(),
    body('month').isInt({ min: 1, max: 12 }),
    body('year').isInt({ min: 2020, max: 2100 }),
    body('fuelName').trim().notEmpty(),
    body('quantity').isFloat({ min: 0 }),
    body('unit').trim().notEmpty()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { fuelName, quantity, emissionFactor } = req.body;

      // Look up emission factor
      let ef = emissionFactor;
      let fuelTypeId = null;

      if (!ef) {
        const fuelEF = await EmissionFactor.findOne({
          type: EmissionFactorType.FUEL,
          name: { $regex: new RegExp(fuelName, 'i') },
          isActive: true
        });
        if (fuelEF) {
          ef = fuelEF.emissionFactor;
          fuelTypeId = fuelEF._id;
        }
      }

      const calculatedEmissions = ef ? quantity * ef : undefined;

      const data = await FuelData.create({
        ...req.body,
        organisation: req.user?.organisation,
        fuelType: fuelTypeId,
        emissionFactor: ef,
        calculatedEmissions,
        createdBy: req.user?._id
      });

      res.status(201).json({ success: true, message: 'Fuel data added', data });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to add fuel data' });
    }
  }
);

// @route   DELETE /api/activity-data/fuel/:id
router.delete(
  '/fuel/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await FuelData.findOneAndDelete({
        _id: req.params.id,
        organisation: req.user?.organisation
      });
      if (!data) {
        res.status(404).json({ success: false, message: 'Not found' });
        return;
      }
      res.json({ success: true, message: 'Deleted' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete' });
    }
  }
);

// ==================== PRODUCTION ====================

// @route   GET /api/activity-data/production
router.get('/production', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod, facility, product } = req.query;
    const orgId = req.user?.organisation;

    const filter: Record<string, unknown> = { organisation: orgId };
    if (reportingPeriod) filter.reportingPeriod = reportingPeriod;
    if (facility) filter.facility = facility;
    if (product) filter.product = product;

    const data = await ProductionData.find(filter)
      .populate('facility', 'name')
      .populate('reportingPeriod', 'year quarter')
      .populate('product', 'name cnCode')
      .sort({ year: -1, month: -1 });

    const totals = data.reduce((acc, d) => ({
      totalProduction: acc.totalProduction + (d.quantityProduced || 0)
    }), { totalProduction: 0 });

    res.json({ success: true, data, totals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch production data' });
  }
});

// @route   POST /api/activity-data/production
router.post(
  '/production',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR),
  [
    body('reportingPeriod').isMongoId(),
    body('facility').isMongoId(),
    body('product').isMongoId(),
    body('month').isInt({ min: 1, max: 12 }),
    body('year').isInt({ min: 2020, max: 2100 }),
    body('quantityProduced').isFloat({ min: 0 }),
    body('unit').trim().notEmpty()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      // Get product name
      const Product = (await import('../models/Product')).default;
      const product = await Product.findById(req.body.product);

      const data = await ProductionData.create({
        ...req.body,
        organisation: req.user?.organisation,
        productName: product?.name || 'Unknown',
        createdBy: req.user?._id
      });

      res.status(201).json({ success: true, message: 'Production data added', data });
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 11000) {
        res.status(400).json({ success: false, message: 'Data for this product/month already exists' });
        return;
      }
      res.status(500).json({ success: false, message: 'Failed to add production data' });
    }
  }
);

// @route   DELETE /api/activity-data/production/:id
router.delete(
  '/production/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await ProductionData.findOneAndDelete({
        _id: req.params.id,
        organisation: req.user?.organisation
      });
      if (!data) {
        res.status(404).json({ success: false, message: 'Not found' });
        return;
      }
      res.json({ success: true, message: 'Deleted' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete' });
    }
  }
);

// ==================== PRECURSOR ====================

// @route   GET /api/activity-data/precursor
router.get('/precursor', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod, facility } = req.query;
    const orgId = req.user?.organisation;

    const filter: Record<string, unknown> = { organisation: orgId };
    if (reportingPeriod) filter.reportingPeriod = reportingPeriod;
    if (facility) filter.facility = facility;

    const data = await PrecursorData.find(filter)
      .populate('facility', 'name')
      .populate('reportingPeriod', 'year quarter')
      .sort({ year: -1, month: -1 });

    const totals = data.reduce((acc, d) => ({
      totalQuantity: acc.totalQuantity + (d.quantity || 0),
      directEmissions: acc.directEmissions + (d.calculatedDirectEmissions || 0),
      indirectEmissions: acc.indirectEmissions + (d.calculatedIndirectEmissions || 0)
    }), { totalQuantity: 0, directEmissions: 0, indirectEmissions: 0 });

    res.json({ success: true, data, totals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch precursor data' });
  }
});

// @route   POST /api/activity-data/precursor
router.post(
  '/precursor',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR),
  [
    body('reportingPeriod').isMongoId(),
    body('facility').isMongoId(),
    body('month').isInt({ min: 1, max: 12 }),
    body('year').isInt({ min: 2020, max: 2100 }),
    body('supplierName').trim().notEmpty(),
    body('materialName').trim().notEmpty(),
    body('quantity').isFloat({ min: 0 }),
    body('unit').trim().notEmpty()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { quantity, directEmissionFactor, indirectEmissionFactor } = req.body;

      const calculatedDirectEmissions = directEmissionFactor ? quantity * directEmissionFactor : undefined;
      const calculatedIndirectEmissions = indirectEmissionFactor ? quantity * indirectEmissionFactor : undefined;

      const data = await PrecursorData.create({
        ...req.body,
        organisation: req.user?.organisation,
        calculatedDirectEmissions,
        calculatedIndirectEmissions,
        createdBy: req.user?._id
      });

      res.status(201).json({ success: true, message: 'Precursor data added', data });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to add precursor data' });
    }
  }
);

// @route   DELETE /api/activity-data/precursor/:id
router.delete(
  '/precursor/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await PrecursorData.findOneAndDelete({
        _id: req.params.id,
        organisation: req.user?.organisation
      });
      if (!data) {
        res.status(404).json({ success: false, message: 'Not found' });
        return;
      }
      res.json({ success: true, message: 'Deleted' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete' });
    }
  }
);

// ==================== SUMMARY ====================

// @route   GET /api/activity-data/summary
// @desc    Get activity data summary for a reporting period
// @access  Private
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod } = req.query;
    const orgId = req.user?.organisation;

    if (!reportingPeriod) {
      res.status(400).json({ success: false, message: 'Reporting period required' });
      return;
    }

    const filter = { organisation: orgId, reportingPeriod };

    const [electricity, fuel, production, precursor] = await Promise.all([
      ElectricityData.aggregate([
        { $match: filter },
        { $group: {
          _id: null,
          totalGrid: { $sum: '$gridElectricity' },
          totalRenewable: { $sum: '$renewableElectricity' },
          totalCaptive: { $sum: '$captiveElectricity' },
          totalEmissions: { $sum: '$calculatedEmissions' },
          count: { $sum: 1 }
        }}
      ]),
      FuelData.aggregate([
        { $match: filter },
        { $group: {
          _id: '$fuelName',
          totalQuantity: { $sum: '$quantity' },
          totalEmissions: { $sum: '$calculatedEmissions' },
          count: { $sum: 1 }
        }}
      ]),
      ProductionData.aggregate([
        { $match: filter },
        { $group: {
          _id: '$productName',
          totalProduction: { $sum: '$quantityProduced' },
          count: { $sum: 1 }
        }}
      ]),
      PrecursorData.aggregate([
        { $match: filter },
        { $group: {
          _id: '$materialName',
          totalQuantity: { $sum: '$quantity' },
          directEmissions: { $sum: '$calculatedDirectEmissions' },
          indirectEmissions: { $sum: '$calculatedIndirectEmissions' },
          count: { $sum: 1 }
        }}
      ])
    ]);

    res.json({
      success: true,
      data: {
        electricity: electricity[0] || { totalGrid: 0, totalRenewable: 0, totalCaptive: 0, totalEmissions: 0, count: 0 },
        fuel,
        production,
        precursor
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
});

export default router;

