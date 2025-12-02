import mongoose from 'mongoose';
import CalculationEngine from '../../src/services/calculationEngine';
import { ElectricityData, FuelData, ProductionData, PrecursorData } from '../../src/models/ActivityData';
import Product from '../../src/models/Product';
import EmissionFactor from '../../src/models/EmissionFactor';
import { createTestUser, createTestOrganisation } from '../helpers/testUtils';
import ReportingPeriod, { Quarter } from '../../src/models/ReportingPeriod';

describe('Calculation Engine', () => {
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

    // Seed emission factors
    await EmissionFactor.create([
      { name: 'Natural Gas', type: 'fuel', unit: 'tCO2e/m3', emissionFactor: 0.00202, isDefault: true },
      { name: 'Diesel', type: 'fuel', unit: 'tCO2e/litre', emissionFactor: 0.00268, isDefault: true },
      { name: 'India Grid', type: 'electricity', unit: 'tCO2e/MWh', countryCode: 'IN', emissionFactor: 0.716, isDefault: true }
    ]);
  });

  describe('run()', () => {
    it('should calculate Scope 1 emissions from fuel data', async () => {
      // Create product
      const product = await Product.create({
        organisation: orgId,
        name: 'Steel Wire Rod',
        cnCode: '72139110',
        unit: 'tonnes',
        isActive: true
      });

      // Create fuel data
      await FuelData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 1,
        fuelName: 'Natural Gas',
        fuelType: 'natural_gas',
        quantity: 10000, // m3
        unit: 'm3',
        emissionFactor: 0.00202
      });

      // Create production data
      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        product: product._id,
        productName: 'Steel Wire Rod',
        cnCode: '72139110',
        month: 1,
        quantityProduced: 500,
        unit: 'tonnes'
      });

      const engine = new CalculationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      expect(result.success).toBe(true);
      expect(result.calculation).toBeDefined();
      
      // 10000 m3 * 0.00202 = 20.2 tCO2e
      expect(result.calculation?.totalScope1).toBeCloseTo(20.2, 1);
    });

    it('should calculate Scope 2 emissions from electricity data', async () => {
      // Create product
      const product = await Product.create({
        organisation: orgId,
        name: 'Steel Wire Rod',
        cnCode: '72139110',
        unit: 'tonnes',
        isActive: true
      });

      // Create electricity data (100,000 kWh = 100 MWh)
      await ElectricityData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 1,
        gridElectricity: 100000, // kWh
        gridEmissionFactor: 0.716
      });

      // Create production data
      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        product: product._id,
        productName: 'Steel Wire Rod',
        cnCode: '72139110',
        month: 1,
        quantityProduced: 500,
        unit: 'tonnes'
      });

      const engine = new CalculationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      expect(result.success).toBe(true);
      
      // 100 MWh * 0.716 = 71.6 tCO2e
      expect(result.calculation?.totalScope2).toBeCloseTo(71.6, 1);
    });

    it('should calculate Scope 3 emissions from precursor data', async () => {
      // Create product
      const product = await Product.create({
        organisation: orgId,
        name: 'Steel Wire Rod',
        cnCode: '72139110',
        unit: 'tonnes',
        isActive: true
      });

      // Create precursor data
      await PrecursorData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 1,
        supplierName: 'Iron Supplier',
        materialName: 'Iron Ore',
        cnCode: '26011100',
        quantity: 1000,
        unit: 'tonnes',
        directEmissionFactor: 1.5,
        indirectEmissionFactor: 0.3
      });

      // Create production data
      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        product: product._id,
        productName: 'Steel Wire Rod',
        cnCode: '72139110',
        month: 1,
        quantityProduced: 500,
        unit: 'tonnes'
      });

      const engine = new CalculationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      expect(result.success).toBe(true);
      
      // 1000 tonnes * (1.5 + 0.3) = 1800 tCO2e
      expect(result.calculation?.totalScope3).toBeCloseTo(1800, 0);
    });

    it('should calculate SEE correctly', async () => {
      // Create product
      const product = await Product.create({
        organisation: orgId,
        name: 'Steel Wire Rod',
        cnCode: '72139110',
        unit: 'tonnes',
        isActive: true
      });

      // Add all types of activity data
      await FuelData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 1,
        fuelName: 'Natural Gas',
        quantity: 5000, // 5000 * 0.00202 = 10.1 tCO2e
        unit: 'm3',
        emissionFactor: 0.00202
      });

      await ElectricityData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 1,
        gridElectricity: 50000, // 50 MWh * 0.716 = 35.8 tCO2e
        gridEmissionFactor: 0.716
      });

      await PrecursorData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 1,
        supplierName: 'Supplier A',
        materialName: 'Raw Material',
        quantity: 100, // 100 * (1.0 + 0.2) = 120 tCO2e
        unit: 'tonnes',
        directEmissionFactor: 1.0,
        indirectEmissionFactor: 0.2
      });

      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        product: product._id,
        productName: 'Steel Wire Rod',
        cnCode: '72139110',
        month: 1,
        quantityProduced: 100,
        unit: 'tonnes'
      });

      const engine = new CalculationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      expect(result.success).toBe(true);
      expect(result.calculation?.products).toHaveLength(1);
      
      // Total emissions ≈ 10.1 + 35.8 + 120 = 165.9 tCO2e
      // SEE = 165.9 / 100 = 1.659 tCO2e/t
      const productCalc = result.calculation?.products[0];
      expect(productCalc?.seeTotal).toBeGreaterThan(0);
      expect(productCalc?.totalEmissions).toBeCloseTo(165.9, 0);
    });

    it('should return error when no production data exists', async () => {
      const engine = new CalculationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No production data');
    });

    it('should handle multiple products correctly', async () => {
      // Create two products
      const product1 = await Product.create({
        organisation: orgId,
        name: 'Product A',
        cnCode: '72139110',
        unit: 'tonnes',
        isActive: true
      });

      const product2 = await Product.create({
        organisation: orgId,
        name: 'Product B',
        cnCode: '72131000',
        unit: 'tonnes',
        isActive: true
      });

      // Create production data for both
      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        product: product1._id,
        productName: 'Product A',
        cnCode: '72139110',
        month: 1,
        quantityProduced: 300,
        unit: 'tonnes'
      });

      await ProductionData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        product: product2._id,
        productName: 'Product B',
        cnCode: '72131000',
        month: 1,
        quantityProduced: 200,
        unit: 'tonnes'
      });

      // Shared electricity consumption
      await ElectricityData.create({
        organisation: orgId,
        reportingPeriod: periodId,
        month: 1,
        gridElectricity: 100000,
        gridEmissionFactor: 0.716
      });

      const engine = new CalculationEngine({
        organisationId: orgId,
        reportingPeriodId: periodId,
        userId
      });

      const result = await engine.run();

      expect(result.success).toBe(true);
      expect(result.calculation?.products).toHaveLength(2);
      
      // Emissions should be allocated proportionally (60% and 40%)
      const totalProd = 500;
      const productA = result.calculation?.products.find(p => p.productName === 'Product A');
      const productB = result.calculation?.products.find(p => p.productName === 'Product B');
      
      expect(productA?.productionQuantity).toBe(300);
      expect(productB?.productionQuantity).toBe(200);
    });
  });
});

