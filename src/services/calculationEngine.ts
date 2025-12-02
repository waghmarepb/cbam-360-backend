import mongoose from 'mongoose';
import Calculation, { ICalculation, IProductCalculation, IScopeDetail, CalculationStatus } from '../models/Calculation';
import { ElectricityData, FuelData, ProductionData, PrecursorData } from '../models/ActivityData';
import EmissionFactor, { EmissionFactorType } from '../models/EmissionFactor';
import Product from '../models/Product';
import { SupplierDeclaration, DeclarationStatus } from '../models/Supplier';

interface CalculationInput {
  organisationId: mongoose.Types.ObjectId;
  reportingPeriodId: mongoose.Types.ObjectId;
  facilityId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}

interface CalculationResult {
  success: boolean;
  calculation?: ICalculation;
  error?: string;
}

export class CalculationEngine {
  private orgId: mongoose.Types.ObjectId;
  private periodId: mongoose.Types.ObjectId;
  private facilityId?: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;

  constructor(input: CalculationInput) {
    this.orgId = input.organisationId;
    this.periodId = input.reportingPeriodId;
    this.facilityId = input.facilityId;
    this.userId = input.userId;
  }

  async run(): Promise<CalculationResult> {
    try {
      // 1. Get all production data (products produced)
      const productionData = await this.getProductionData();
      
      if (productionData.length === 0) {
        return {
          success: false,
          error: 'No production data found for this period. Please add production data first.'
        };
      }

      // 2. Get activity data
      const [electricityData, fuelData, precursorData] = await Promise.all([
        this.getElectricityData(),
        this.getFuelData(),
        this.getPrecursorData()
      ]);

      // 3. Get supplier declarations
      const supplierDeclarations = await this.getSupplierDeclarations();

      // 4. Calculate totals
      const totalProduction = productionData.reduce((sum, p) => sum + p.quantityProduced, 0);

      // 5. Calculate Scope 1 (Fuel emissions)
      const { scope1Total, scope1Details } = await this.calculateScope1(fuelData);

      // 6. Calculate Scope 2 (Electricity emissions)
      const { scope2Total, scope2Details } = await this.calculateScope2(electricityData);

      // 7. Calculate Scope 3 (Precursor emissions)
      const { scope3Direct, scope3Indirect, scope3Total, scope3Details } = 
        await this.calculateScope3(precursorData, supplierDeclarations);

      // 8. Calculate total emissions
      const totalEmissions = scope1Total + scope2Total + scope3Total;

      // 9. Allocate emissions to products and calculate SEE
      const productCalculations = await this.allocateToProducts(
        productionData,
        totalProduction,
        { scope1Total, scope1Details },
        { scope2Total, scope2Details },
        { scope3Direct, scope3Indirect, scope3Total, scope3Details }
      );

      // 10. Create or update calculation record
      const calculation = await Calculation.findOneAndUpdate(
        {
          organisation: this.orgId,
          reportingPeriod: this.periodId,
          status: { $ne: CalculationStatus.FINALIZED }
        },
        {
          organisation: this.orgId,
          reportingPeriod: this.periodId,
          facility: this.facilityId,
          totalScope1: scope1Total,
          totalScope2: scope2Total,
          totalScope3Direct: scope3Direct,
          totalScope3Indirect: scope3Indirect,
          totalScope3: scope3Total,
          totalEmissions,
          totalProduction,
          products: productCalculations,
          status: CalculationStatus.CALCULATED,
          calculatedAt: new Date(),
          calculatedBy: this.userId,
          $inc: { version: 1 }
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        calculation
      };

    } catch (error) {
      console.error('Calculation engine error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Calculation failed'
      };
    }
  }

  private async getProductionData() {
    const filter: Record<string, unknown> = {
      organisation: this.orgId,
      reportingPeriod: this.periodId
    };
    if (this.facilityId) filter.facility = this.facilityId;

    return ProductionData.find(filter).populate('product', 'name cnCode');
  }

  private async getElectricityData() {
    const filter: Record<string, unknown> = {
      organisation: this.orgId,
      reportingPeriod: this.periodId
    };
    if (this.facilityId) filter.facility = this.facilityId;

    return ElectricityData.find(filter);
  }

  private async getFuelData() {
    const filter: Record<string, unknown> = {
      organisation: this.orgId,
      reportingPeriod: this.periodId
    };
    if (this.facilityId) filter.facility = this.facilityId;

    return FuelData.find(filter);
  }

  private async getPrecursorData() {
    const filter: Record<string, unknown> = {
      organisation: this.orgId,
      reportingPeriod: this.periodId
    };
    if (this.facilityId) filter.facility = this.facilityId;

    return PrecursorData.find(filter);
  }

  private async getSupplierDeclarations() {
    return SupplierDeclaration.find({
      organisation: this.orgId,
      reportingPeriod: this.periodId,
      status: DeclarationStatus.VERIFIED
    });
  }

  private async calculateScope1(fuelData: typeof FuelData.prototype[]) {
    const scope1Details: IScopeDetail[] = [];
    let scope1Total = 0;

    for (const fuel of fuelData) {
      let ef = fuel.emissionFactor;
      
      // Look up EF if not already calculated
      if (!ef && fuel.fuelType) {
        const efDoc = await EmissionFactor.findById(fuel.fuelType);
        ef = efDoc?.emissionFactor || 0;
      }
      
      // Try to match fuel name to EF
      if (!ef) {
        const efDoc = await EmissionFactor.findOne({
          type: EmissionFactorType.FUEL,
          name: { $regex: new RegExp(fuel.fuelName, 'i') },
          isActive: true
        });
        ef = efDoc?.emissionFactor || 0;
      }

      // Convert quantity to tonnes if needed
      let quantityInTonnes = fuel.quantity;
      if (fuel.unit === 'kg') quantityInTonnes = fuel.quantity / 1000;
      else if (fuel.unit === 'litre') quantityInTonnes = fuel.quantity * 0.00084; // Approximate

      const emissions = quantityInTonnes * (ef || 0);
      scope1Total += emissions;

      scope1Details.push({
        source: fuel.fuelName,
        sourceId: fuel._id,
        quantity: fuel.quantity,
        unit: fuel.unit,
        emissionFactor: ef || 0,
        emissionFactorUnit: 'tCO2e/t',
        emissions
      });
    }

    return { scope1Total, scope1Details };
  }

  private async calculateScope2(electricityData: typeof ElectricityData.prototype[]) {
    const scope2Details: IScopeDetail[] = [];
    let scope2Total = 0;

    for (const elec of electricityData) {
      // Grid electricity
      if (elec.gridElectricity > 0) {
        const gridEF = elec.gridEmissionFactor || 0.716; // Default India EF
        const gridMWh = elec.gridElectricity / 1000;
        const gridEmissions = gridMWh * gridEF;
        scope2Total += gridEmissions;

        scope2Details.push({
          source: 'Grid Electricity',
          sourceId: elec._id,
          quantity: elec.gridElectricity,
          unit: 'kWh',
          emissionFactor: gridEF,
          emissionFactorUnit: 'tCO2e/MWh',
          emissions: gridEmissions
        });
      }

      // Captive/DG electricity
      if (elec.captiveElectricity > 0) {
        const captiveEF = elec.captiveEmissionFactor || 0.8;
        const captiveMWh = elec.captiveElectricity / 1000;
        const captiveEmissions = captiveMWh * captiveEF;
        scope2Total += captiveEmissions;

        scope2Details.push({
          source: 'Captive/DG Power',
          sourceId: elec._id,
          quantity: elec.captiveElectricity,
          unit: 'kWh',
          emissionFactor: captiveEF,
          emissionFactorUnit: 'tCO2e/MWh',
          emissions: captiveEmissions
        });
      }

      // Renewable - zero emissions but track it
      if (elec.renewableElectricity > 0) {
        scope2Details.push({
          source: 'Renewable Electricity',
          sourceId: elec._id,
          quantity: elec.renewableElectricity,
          unit: 'kWh',
          emissionFactor: 0,
          emissionFactorUnit: 'tCO2e/MWh',
          emissions: 0
        });
      }
    }

    return { scope2Total, scope2Details };
  }

  private async calculateScope3(
    precursorData: typeof PrecursorData.prototype[],
    supplierDeclarations: typeof SupplierDeclaration.prototype[]
  ) {
    const scope3Details: IScopeDetail[] = [];
    let scope3Direct = 0;
    let scope3Indirect = 0;

    // Create a map of supplier declarations by material name
    const declarationMap = new Map<string, typeof supplierDeclarations[0]>();
    for (const decl of supplierDeclarations) {
      declarationMap.set(decl.productName.toLowerCase(), decl);
    }

    for (const precursor of precursorData) {
      let directEF = precursor.directEmissionFactor || 0;
      let indirectEF = precursor.indirectEmissionFactor || 0;

      // Try to find supplier declaration
      const declaration = declarationMap.get(precursor.materialName.toLowerCase());
      if (declaration) {
        directEF = declaration.directEmissionFactor;
        indirectEF = declaration.indirectEmissionFactor;
      }

      // Fall back to CBAM defaults if no EF
      if (directEF === 0 && indirectEF === 0) {
        const defaultEF = await EmissionFactor.findOne({
          type: EmissionFactorType.DEFAULT,
          isActive: true,
          $or: [
            { name: { $regex: new RegExp(precursor.materialName, 'i') } },
            { cnCode: precursor.cnCode }
          ]
        });
        
        if (defaultEF) {
          // Split default EF into direct/indirect (80/20 assumption)
          directEF = defaultEF.emissionFactor * 0.8;
          indirectEF = defaultEF.emissionFactor * 0.2;
        }
      }

      // Convert quantity to tonnes
      let quantityInTonnes = precursor.quantity;
      if (precursor.unit === 'kg') quantityInTonnes = precursor.quantity / 1000;

      const directEmissions = quantityInTonnes * directEF;
      const indirectEmissions = quantityInTonnes * indirectEF;
      
      scope3Direct += directEmissions;
      scope3Indirect += indirectEmissions;

      scope3Details.push({
        source: `${precursor.supplierName} - ${precursor.materialName}`,
        sourceId: precursor._id,
        quantity: precursor.quantity,
        unit: precursor.unit,
        emissionFactor: directEF + indirectEF,
        emissionFactorUnit: 'tCO2e/t',
        emissions: directEmissions + indirectEmissions
      });
    }

    return {
      scope3Direct,
      scope3Indirect,
      scope3Total: scope3Direct + scope3Indirect,
      scope3Details
    };
  }

  private async allocateToProducts(
    productionData: typeof ProductionData.prototype[],
    totalProduction: number,
    scope1: { scope1Total: number; scope1Details: IScopeDetail[] },
    scope2: { scope2Total: number; scope2Details: IScopeDetail[] },
    scope3: { scope3Direct: number; scope3Indirect: number; scope3Total: number; scope3Details: IScopeDetail[] }
  ): Promise<IProductCalculation[]> {
    const productCalculations: IProductCalculation[] = [];

    // Group production by product
    const productGroups = new Map<string, { 
      product: mongoose.Types.ObjectId;
      productName: string;
      cnCode: string;
      quantity: number;
    }>();

    for (const prod of productionData) {
      const productDoc = prod.product as unknown as { _id: mongoose.Types.ObjectId; name: string; cnCode: string };
      const key = productDoc._id.toString();
      
      if (productGroups.has(key)) {
        const existing = productGroups.get(key)!;
        existing.quantity += prod.quantityProduced;
      } else {
        productGroups.set(key, {
          product: productDoc._id,
          productName: productDoc.name || prod.productName,
          cnCode: productDoc.cnCode || '',
          quantity: prod.quantityProduced
        });
      }
    }

    // Allocate emissions to products based on production share
    for (const [_, productData] of productGroups) {
      const share = totalProduction > 0 ? productData.quantity / totalProduction : 0;

      const productScope1 = scope1.scope1Total * share;
      const productScope2 = scope2.scope2Total * share;
      const productScope3Direct = scope3.scope3Direct * share;
      const productScope3Indirect = scope3.scope3Indirect * share;
      const productScope3Total = scope3.scope3Total * share;
      const productTotal = productScope1 + productScope2 + productScope3Total;

      // Calculate SEE
      const seeTotal = productData.quantity > 0 ? productTotal / productData.quantity : 0;
      const seeDirect = productData.quantity > 0 ? (productScope1 + productScope3Direct) / productData.quantity : 0;
      const seeIndirect = productData.quantity > 0 ? (productScope2 + productScope3Indirect) / productData.quantity : 0;

      productCalculations.push({
        product: productData.product,
        productName: productData.productName,
        cnCode: productData.cnCode,
        productionQuantity: productData.quantity,
        productionUnit: 'tonnes',
        
        scope1Emissions: productScope1,
        scope1Details: scope1.scope1Details.map(d => ({ ...d, emissions: d.emissions * share })),
        
        scope2Emissions: productScope2,
        scope2Details: scope2.scope2Details.map(d => ({ ...d, emissions: d.emissions * share })),
        
        scope3DirectEmissions: productScope3Direct,
        scope3IndirectEmissions: productScope3Indirect,
        scope3TotalEmissions: productScope3Total,
        scope3Details: scope3.scope3Details.map(d => ({ ...d, emissions: d.emissions * share })),
        
        totalEmissions: productTotal,
        seeTotal,
        seeDirect,
        seeIndirect
      });
    }

    return productCalculations;
  }
}

export default CalculationEngine;

