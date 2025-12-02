import mongoose from 'mongoose';
import ValidationEngine from '../../src/services/validationEngine';
import { ElectricityData, FuelData, ProductionData } from '../../src/models/ActivityData';
import Product from '../../src/models/Product';
import CNCode, { CBAMCategory } from '../../src/models/CNCode';
import { createTestUser, createTestOrganisation } from '../helpers/testUtils';
import ReportingPeriod, { Quarter } from '../../src/models/ReportingPeriod';
import { ValidationSeverity, ValidationCategory } from '../../src/models/Validation';

describe('Validation Engine', () => {
  let orgId: mongoose.Types.ObjectId;
  let periodId: mongoose.Types.ObjectId;
  let userId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Create test organisation and user
    const org = await createTestOrganisation();
    const { user } = await createTestUser({ organisationId: org._id });
    orgId = org._id;
    userId = user._id;

    // Create reporting period
    const period = await ReportingPeriod.create({
      organisation: orgId,
      year: 2024,
      quarter: Quarter.Q1,
      status: 'draft',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31')
    });
    periodId = period._id;

    // Seed CN codes
    await CNCode.create([
      { code: '72139110', description: 'Steel wire rod', category: CBAMCategory.IRON_STEEL, cbamApplicable: true },
      { code: '72131000', description: 'Hot-rolled bars', category: CBAMCategory.IRON_STEEL, cbamApplicable: true }
    ]);
  });

  describe('run()', () => {
    it('should pass validation with complete and correct data', async () => {
      // Create valid product
      await Product.create({
        organisation: orgId,
        name: 'Steel Wire Rod',
        cnCode: '72139110',
        unit: 'tonnes',
        isActive: true
      });

      // Create complete activity data
      await ElectricityData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 1,
        gridElectricity: 50000,
        gridEmissionFactor: 0.716
      });

      await ElectricityData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 2,
        gridElectricity: 55000,
        gridEmissionFactor: 0.716
      });

      await ElectricityData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 3,
        gridElectricity: 52000,
        gridEmissionFactor: 0.716
      });

      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        productName: 'Steel Wire Rod',
        cnCode: '72139110',
        month: 1,
        quantityProduced: 100,
        unit: 'tonnes'
      });

      const engine = new ValidationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      expect(result.status).toBe('passed');
      expect(result.errorCount).toBe(0);
    });

    it('should flag invalid CN code format', async () => {
      await Product.create({
        organisation: orgId,
        name: 'Invalid Product',
        cnCode: '123', // Invalid - should be 8 digits
        unit: 'tonnes',
        isActive: true
      });

      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        productName: 'Invalid Product',
        cnCode: '123',
        month: 1,
        quantityProduced: 100,
        unit: 'tonnes'
      });

      const engine = new ValidationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      expect(result.errorCount).toBeGreaterThan(0);
      const cnCodeErrors = result.errors.filter(
        e => e.category === ValidationCategory.CN_CODE
      );
      expect(cnCodeErrors.length).toBeGreaterThan(0);
    });

    it('should warn about missing production data', async () => {
      // No production data created

      const engine = new ValidationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      expect(result.status).toBe('failed');
      const completenessErrors = result.errors.filter(
        e => e.category === ValidationCategory.COMPLETENESS
      );
      expect(completenessErrors.length).toBeGreaterThan(0);
    });

    it('should warn about missing electricity data', async () => {
      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        productName: 'Steel Wire Rod',
        cnCode: '72139110',
        month: 1,
        quantityProduced: 100,
        unit: 'tonnes'
      });

      // No electricity data

      const engine = new ValidationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      const warnings = result.errors.filter(
        e => e.severity === ValidationSeverity.WARNING
      );
      expect(warnings.some(w => w.field === 'electricity')).toBe(true);
    });

    it('should detect negative values', async () => {
      await ElectricityData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 1,
        gridElectricity: -5000, // Invalid negative value
        gridEmissionFactor: 0.716
      });

      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        productName: 'Steel Wire Rod',
        cnCode: '72139110',
        month: 1,
        quantityProduced: 100,
        unit: 'tonnes'
      });

      const engine = new ValidationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      const numericErrors = result.errors.filter(
        e => e.category === ValidationCategory.NUMERIC_FORMAT
      );
      expect(numericErrors.length).toBeGreaterThan(0);
    });

    it('should warn about incomplete monthly data', async () => {
      // Only 1 month of data for quarterly report
      await ElectricityData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 1,
        gridElectricity: 50000,
        gridEmissionFactor: 0.716
      });

      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        productName: 'Steel Wire Rod',
        cnCode: '72139110',
        month: 1,
        quantityProduced: 100,
        unit: 'tonnes'
      });

      const engine = new ValidationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      const completenessWarnings = result.errors.filter(
        e => e.category === ValidationCategory.COMPLETENESS && 
             e.severity === ValidationSeverity.WARNING
      );
      expect(completenessWarnings.some(w => w.field === 'months')).toBe(true);
    });

    it('should flag outlier values', async () => {
      // Create unusually high electricity consumption
      await ElectricityData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 1,
        gridElectricity: 50000000, // 50 million kWh - outlier
        gridEmissionFactor: 0.716
      });

      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        productName: 'Steel Wire Rod',
        cnCode: '72139110',
        month: 1,
        quantityProduced: 100,
        unit: 'tonnes'
      });

      const engine = new ValidationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      const outlierWarnings = result.errors.filter(
        e => e.category === ValidationCategory.OUTLIER
      );
      expect(outlierWarnings.length).toBeGreaterThan(0);
    });
  });
});

