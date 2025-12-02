import { Router, Response } from 'express';
import { query } from 'express-validator';
import mongoose from 'mongoose';
import ExportService from '../services/exportService';
import { authenticate, AuthRequest } from '../middleware/auth';
import auditService from '../services/auditService';
import { AuditResource, AuditAction } from '../models/AuditLog';

const router = Router();

router.use(authenticate);

// @route   GET /api/exports/calculations
// @desc    Export calculations to CSV
// @access  Private
router.get(
  '/calculations',
  query('reportingPeriod').optional().isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user?.organisation as mongoose.Types.ObjectId;
      const periodId = req.query.reportingPeriod 
        ? new mongoose.Types.ObjectId(req.query.reportingPeriod as string)
        : undefined;

      const exportService = new ExportService({
        organisationId: orgId,
        reportingPeriodId: periodId
      });

      const csv = await exportService.exportCalculations();

      // Audit log
      await auditService.logExport(
        orgId,
        req.user?._id as mongoose.Types.ObjectId,
        AuditResource.CALCULATION,
        'CSV',
        { reportingPeriod: periodId?.toString() },
        req
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="calculations_export.csv"');
      res.send(csv);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ success: false, message: 'Export failed' });
    }
  }
);

// @route   GET /api/exports/activity-data/:type
// @desc    Export activity data to CSV
// @access  Private
router.get(
  '/activity-data/:type',
  query('reportingPeriod').optional().isMongoId(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { type } = req.params;
      const orgId = req.user?.organisation as mongoose.Types.ObjectId;
      const periodId = req.query.reportingPeriod 
        ? new mongoose.Types.ObjectId(req.query.reportingPeriod as string)
        : undefined;

      if (!['electricity', 'fuel', 'production', 'precursor'].includes(type)) {
        res.status(400).json({ success: false, message: 'Invalid export type' });
        return;
      }

      const exportService = new ExportService({
        organisationId: orgId,
        reportingPeriodId: periodId
      });

      const csv = await exportService.exportActivityData(type as 'electricity' | 'fuel' | 'production' | 'precursor');

      // Audit log
      await auditService.logExport(
        orgId,
        req.user?._id as mongoose.Types.ObjectId,
        AuditResource.ACTIVITY_DATA,
        'CSV',
        { type, reportingPeriod: periodId?.toString() },
        req
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_export.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ success: false, message: 'Export failed' });
    }
  }
);

// @route   GET /api/exports/products
// @desc    Export products to CSV
// @access  Private
router.get('/products', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organisation as mongoose.Types.ObjectId;

    const exportService = new ExportService({ organisationId: orgId });
    const csv = await exportService.exportProducts();

    await auditService.logExport(
      orgId,
      req.user?._id as mongoose.Types.ObjectId,
      AuditResource.PRODUCT,
      'CSV',
      undefined,
      req
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products_export.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// @route   GET /api/exports/suppliers
// @desc    Export suppliers to CSV
// @access  Private
router.get('/suppliers', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organisation as mongoose.Types.ObjectId;

    const exportService = new ExportService({ organisationId: orgId });
    const csv = await exportService.exportSuppliers();

    await auditService.logExport(
      orgId,
      req.user?._id as mongoose.Types.ObjectId,
      AuditResource.SUPPLIER,
      'CSV',
      undefined,
      req
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="suppliers_export.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// @route   GET /api/exports/summary
// @desc    Export full emissions summary
// @access  Private
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organisation as mongoose.Types.ObjectId;

    const exportService = new ExportService({ organisationId: orgId });
    const csv = await exportService.exportEmissionsSummary();

    await auditService.logExport(
      orgId,
      req.user?._id as mongoose.Types.ObjectId,
      AuditResource.REPORT,
      'CSV',
      { type: 'summary' },
      req
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="emissions_summary.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

export default router;

