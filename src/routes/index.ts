import { Router } from 'express';
import authRoutes from './auth';
import organisationRoutes from './organisations';
import facilityRoutes from './facilities';
import reportingPeriodRoutes from './reportingPeriods';
import cnCodeRoutes from './cnCodes';
import productRoutes from './products';
import emissionFactorRoutes from './emissionFactors';
import activityDataRoutes from './activityData';
import supplierRoutes from './suppliers';
import calculationRoutes from './calculations';
import reportRoutes from './reports';
import userRoutes from './users';
import auditRoutes from './audit';
import templateRoutes from './templates';
import importRoutes from './imports';
import exportRoutes from './exports';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'CBAM360 API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/organisations', organisationRoutes);
router.use('/facilities', facilityRoutes);
router.use('/reporting-periods', reportingPeriodRoutes);
router.use('/cn-codes', cnCodeRoutes);
router.use('/products', productRoutes);
router.use('/emission-factors', emissionFactorRoutes);
router.use('/activity-data', activityDataRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/calculations', calculationRoutes);
router.use('/reports', reportRoutes);
router.use('/users', userRoutes);
router.use('/audit', auditRoutes);
router.use('/templates', templateRoutes);
router.use('/imports', importRoutes);
router.use('/exports', exportRoutes);

export default router;
