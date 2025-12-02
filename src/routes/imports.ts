import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import ImportService, { parseCSV } from '../services/importService';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/User';
import auditService from '../services/auditService';
import { AuditResource, AuditAction } from '../models/AuditLog';

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR));

// @route   POST /api/imports/:type
// @desc    Import data from CSV
// @access  Private (Admin, Manager, Operator)
router.post(
  '/:type',
  [
    body('content').notEmpty().withMessage('CSV content is required'),
    body('reportingPeriod').optional().isMongoId(),
    body('facility').optional().isMongoId()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { type } = req.params;
      const { content, reportingPeriod, facility } = req.body;
      const orgId = req.user?.organisation as mongoose.Types.ObjectId;

      // Parse CSV
      const rows = parseCSV(content);
      if (rows.length === 0) {
        res.status(400).json({ success: false, message: 'No data rows found in CSV' });
        return;
      }

      // Create import service
      const importService = new ImportService(
        orgId,
        reportingPeriod ? new mongoose.Types.ObjectId(reportingPeriod) : new mongoose.Types.ObjectId(),
        facility ? new mongoose.Types.ObjectId(facility) : undefined
      );

      let result;

      switch (type) {
        case 'electricity':
          if (!reportingPeriod) {
            res.status(400).json({ success: false, message: 'Reporting period required for activity data' });
            return;
          }
          result = await importService.importElectricity(rows);
          break;

        case 'fuel':
          if (!reportingPeriod) {
            res.status(400).json({ success: false, message: 'Reporting period required for activity data' });
            return;
          }
          result = await importService.importFuel(rows);
          break;

        case 'production':
          if (!reportingPeriod) {
            res.status(400).json({ success: false, message: 'Reporting period required for activity data' });
            return;
          }
          result = await importService.importProduction(rows);
          break;

        case 'precursor':
          if (!reportingPeriod) {
            res.status(400).json({ success: false, message: 'Reporting period required for activity data' });
            return;
          }
          result = await importService.importPrecursor(rows);
          break;

        case 'products':
          result = await importService.importProducts(rows);
          break;

        case 'suppliers':
          result = await importService.importSuppliers(rows);
          break;

        default:
          res.status(400).json({ success: false, message: 'Invalid import type' });
          return;
      }

      // Audit log
      await auditService.log({
        organisation: orgId,
        user: req.user?._id as mongoose.Types.ObjectId,
        action: AuditAction.IMPORT,
        resource: AuditResource.ACTIVITY_DATA,
        description: `Imported ${result.imported} ${type} records`,
        metadata: {
          type,
          imported: result.imported,
          failed: result.failed,
          reportingPeriod
        },
        req
      });

      res.json({
        success: result.success,
        message: `Imported ${result.imported} records, ${result.failed} failed`,
        data: result
      });
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({ success: false, message: 'Import failed' });
    }
  }
);

export default router;

