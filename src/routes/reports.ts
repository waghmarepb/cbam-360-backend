import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Report, { ReportType, ReportStatus } from '../models/Report';
import Calculation, { CalculationStatus } from '../models/Calculation';
import XMLGenerator from '../services/xmlGenerator';
import DashboardService from '../services/dashboardService';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticate);

// ==================== DASHBOARD ====================

// @route   GET /api/reports/dashboard/summary
// @desc    Get dashboard summary
// @access  Private
router.get('/dashboard/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod } = req.query;
    const dashboard = new DashboardService(req.user?.organisation as mongoose.Types.ObjectId);
    const summary = await dashboard.getSummary(reportingPeriod as string);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard summary' });
  }
});

// @route   GET /api/reports/dashboard/scope-breakdown
// @desc    Get scope breakdown for pie chart
// @access  Private
router.get('/dashboard/scope-breakdown', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod } = req.query;
    const dashboard = new DashboardService(req.user?.organisation as mongoose.Types.ObjectId);
    const breakdown = await dashboard.getScopeBreakdown(reportingPeriod as string);
    res.json({ success: true, data: breakdown });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch scope breakdown' });
  }
});

// @route   GET /api/reports/dashboard/product-see
// @desc    Get product SEE for bar chart
// @access  Private
router.get('/dashboard/product-see', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod } = req.query;
    const dashboard = new DashboardService(req.user?.organisation as mongoose.Types.ObjectId);
    const products = await dashboard.getProductSEE(reportingPeriod as string);
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch product SEE' });
  }
});

// @route   GET /api/reports/dashboard/monthly-trend
// @desc    Get monthly emission trend
// @access  Private
router.get('/dashboard/monthly-trend', async (req: AuthRequest, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const dashboard = new DashboardService(req.user?.organisation as mongoose.Types.ObjectId);
    const trend = await dashboard.getMonthlyTrend(year);
    res.json({ success: true, data: trend });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch monthly trend' });
  }
});

// @route   GET /api/reports/dashboard/supplier-contribution
// @desc    Get top supplier contributions
// @access  Private
router.get('/dashboard/supplier-contribution', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod } = req.query;
    const dashboard = new DashboardService(req.user?.organisation as mongoose.Types.ObjectId);
    const suppliers = await dashboard.getSupplierContribution(reportingPeriod as string);
    res.json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch supplier contribution' });
  }
});

// @route   GET /api/reports/dashboard/energy-mix
// @desc    Get energy mix (grid vs renewable)
// @access  Private
router.get('/dashboard/energy-mix', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod } = req.query;
    const dashboard = new DashboardService(req.user?.organisation as mongoose.Types.ObjectId);
    const mix = await dashboard.getEnergyMix(reportingPeriod as string);
    res.json({ success: true, data: mix });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch energy mix' });
  }
});

// @route   GET /api/reports/dashboard/quarter-comparison
// @desc    Get quarter comparison
// @access  Private
router.get('/dashboard/quarter-comparison', async (req: AuthRequest, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const dashboard = new DashboardService(req.user?.organisation as mongoose.Types.ObjectId);
    const comparison = await dashboard.getQuarterComparison(year);
    res.json({ success: true, data: comparison });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch quarter comparison' });
  }
});

// ==================== XML GENERATION ====================

// @route   GET /api/reports
// @desc    Get all reports
// @access  Private
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { reportingPeriod, type } = req.query;
    const filter: Record<string, unknown> = { organisation: req.user?.organisation };
    
    if (reportingPeriod) filter.reportingPeriod = reportingPeriod;
    if (type) filter.type = type;

    const reports = await Report.find(filter)
      .populate('reportingPeriod', 'year quarter')
      .populate('generatedBy', 'firstName lastName')
      .sort({ generatedAt: -1 });

    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
});

// @route   POST /api/reports/xml/generate
// @desc    Generate CBAM XML report
// @access  Private (Admin, Manager)
router.post(
  '/xml/generate',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    body('reportingPeriod').isMongoId().withMessage('Valid reporting period required'),
    body('calculationId').isMongoId().withMessage('Valid calculation ID required')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { reportingPeriod, calculationId } = req.body;

      // Verify calculation is finalized
      const calculation = await Calculation.findOne({
        _id: calculationId,
        organisation: req.user?.organisation
      });

      if (!calculation) {
        res.status(404).json({ success: false, message: 'Calculation not found' });
        return;
      }

      if (calculation.status !== CalculationStatus.FINALIZED && calculation.status !== CalculationStatus.VALIDATED) {
        res.status(400).json({ 
          success: false, 
          message: 'Calculation must be validated or finalized before generating XML' 
        });
        return;
      }

      // Generate XML
      const generator = new XMLGenerator({
        organisationId: req.user?.organisation as mongoose.Types.ObjectId,
        reportingPeriodId: new mongoose.Types.ObjectId(reportingPeriod),
        calculationId: new mongoose.Types.ObjectId(calculationId),
        userId: req.user?._id as mongoose.Types.ObjectId
      });

      const result = await generator.generate();

      if (!result.success) {
        res.status(400).json({ success: false, message: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'XML report generated successfully',
        data: {
          report: result.report,
          validationResult: result.report?.validationResult
        }
      });
    } catch (error) {
      console.error('XML generation error:', error);
      res.status(500).json({ success: false, message: 'Failed to generate XML' });
    }
  }
);

// @route   GET /api/reports/xml/:id/preview
// @desc    Preview XML content
// @access  Private
router.get(
  '/xml/:id/preview',
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const report = await Report.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation,
        type: ReportType.CBAM_XML
      });

      if (!report) {
        res.status(404).json({ success: false, message: 'Report not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          fileName: report.fileName,
          xmlContent: report.xmlContent,
          validationResult: report.validationResult,
          generatedAt: report.generatedAt
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to preview XML' });
    }
  }
);

// @route   GET /api/reports/xml/:id/download
// @desc    Download XML file
// @access  Private
router.get(
  '/xml/:id/download',
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const report = await Report.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation,
        type: ReportType.CBAM_XML
      });

      if (!report || !report.xmlContent) {
        res.status(404).json({ success: false, message: 'Report not found' });
        return;
      }

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
      res.send(report.xmlContent);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to download XML' });
    }
  }
);

// @route   GET /api/reports/:id
// @desc    Get report by ID
// @access  Private
router.get(
  '/:id',
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const report = await Report.findOne({
        _id: req.params.id,
        organisation: req.user?.organisation
      })
        .populate('reportingPeriod', 'year quarter')
        .populate('calculation', 'totalEmissions totalProduction status')
        .populate('generatedBy', 'firstName lastName');

      if (!report) {
        res.status(404).json({ success: false, message: 'Report not found' });
        return;
      }

      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch report' });
    }
  }
);

// @route   DELETE /api/reports/:id
// @desc    Delete a report
// @access  Private (Admin)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  param('id').isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const report = await Report.findOneAndDelete({
        _id: req.params.id,
        organisation: req.user?.organisation,
        status: { $ne: ReportStatus.SUBMITTED }
      });

      if (!report) {
        res.status(404).json({ success: false, message: 'Report not found or cannot be deleted' });
        return;
      }

      res.json({ success: true, message: 'Report deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete report' });
    }
  }
);

export default router;

