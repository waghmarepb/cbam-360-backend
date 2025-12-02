import mongoose from 'mongoose';
import ValidationResult, { 
  IValidationError, 
  ValidationSeverity, 
  ValidationCategory 
} from '../models/Validation';
import { ElectricityData, FuelData, ProductionData, PrecursorData } from '../models/ActivityData';
import Product from '../models/Product';
import CNCode from '../models/CNCode';
import Calculation from '../models/Calculation';
import { Supplier, SupplierDeclaration } from '../models/Supplier';

interface ValidationInput {
  organisationId: mongoose.Types.ObjectId;
  reportingPeriodId: mongoose.Types.ObjectId;
  calculationId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}

// Valid country codes (subset)
const VALID_COUNTRY_CODES = new Set([
  'IN', 'CN', 'US', 'DE', 'FR', 'IT', 'ES', 'GB', 'JP', 'KR', 'BR', 'RU', 'AU', 'CA',
  'MX', 'ID', 'TH', 'VN', 'MY', 'PH', 'SG', 'TW', 'PK', 'BD', 'TR', 'SA', 'AE', 'ZA',
  'EG', 'NG', 'AR', 'CL', 'CO', 'PE', 'NL', 'BE', 'PL', 'SE', 'NO', 'DK', 'FI', 'AT',
  'CH', 'CZ', 'HU', 'RO', 'UA', 'GR', 'PT', 'IE', 'NZ'
]);

export class ValidationEngine {
  private orgId: mongoose.Types.ObjectId;
  private periodId: mongoose.Types.ObjectId;
  private calculationId?: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private errors: IValidationError[] = [];

  constructor(input: ValidationInput) {
    this.orgId = input.organisationId;
    this.periodId = input.reportingPeriodId;
    this.calculationId = input.calculationId;
    this.userId = input.userId;
  }

  async run(): Promise<ValidationResult> {
    this.errors = [];

    // Run all validations
    await Promise.all([
      this.validateProducts(),
      this.validateActivityData(),
      this.validateSuppliers(),
      this.validateCalculation(),
      this.validateCompleteness()
    ]);

    // Count errors by severity
    const errorCount = this.errors.filter(e => e.severity === ValidationSeverity.ERROR).length;
    const warningCount = this.errors.filter(e => e.severity === ValidationSeverity.WARNING).length;
    const infoCount = this.errors.filter(e => e.severity === ValidationSeverity.INFO).length;

    // Determine status
    let status: 'passed' | 'failed' | 'warnings' = 'passed';
    if (errorCount > 0) status = 'failed';
    else if (warningCount > 0) status = 'warnings';

    // Create validation result
    const result = await ValidationResult.create({
      organisation: this.orgId,
      reportingPeriod: this.periodId,
      calculation: this.calculationId,
      status,
      errorCount,
      warningCount,
      infoCount,
      errors: this.errors,
      validatedAt: new Date(),
      validatedBy: this.userId
    });

    return result;
  }

  private addError(error: IValidationError) {
    this.errors.push(error);
  }

  private async validateProducts() {
    const products = await Product.find({ 
      organisation: this.orgId, 
      isActive: true 
    });

    for (const product of products) {
      // Validate CN code format
      if (!product.cnCode || !/^\d{8}$/.test(product.cnCode)) {
        this.addError({
          severity: ValidationSeverity.ERROR,
          category: ValidationCategory.CN_CODE,
          field: 'cnCode',
          message: `Product "${product.name}" has invalid CN code format`,
          sourceTable: 'Product',
          sourceId: product._id,
          value: product.cnCode,
          suggestion: 'CN code must be exactly 8 digits'
        });
        continue;
      }

      // Validate CN code exists in CBAM registry
      const cnCodeDoc = await CNCode.findOne({ code: product.cnCode });
      if (!cnCodeDoc) {
        this.addError({
          severity: ValidationSeverity.WARNING,
          category: ValidationCategory.CN_CODE,
          field: 'cnCode',
          message: `CN code ${product.cnCode} for "${product.name}" not found in CBAM registry`,
          sourceTable: 'Product',
          sourceId: product._id,
          value: product.cnCode,
          suggestion: 'Verify the CN code is correct and CBAM applicable'
        });
      } else if (!cnCodeDoc.cbamApplicable) {
        this.addError({
          severity: ValidationSeverity.WARNING,
          category: ValidationCategory.CN_CODE,
          field: 'cnCode',
          message: `CN code ${product.cnCode} may not be CBAM applicable`,
          sourceTable: 'Product',
          sourceId: product._id
        });
      }
    }
  }

  private async validateActivityData() {
    // Get activity data
    const filter = { organisation: this.orgId, reportingPeriod: this.periodId };

    const [electricity, fuel, production, precursor] = await Promise.all([
      ElectricityData.find(filter),
      FuelData.find(filter),
      ProductionData.find(filter),
      PrecursorData.find(filter)
    ]);

    // Validate electricity data
    for (const elec of electricity) {
      if (elec.gridElectricity < 0) {
        this.addError({
          severity: ValidationSeverity.ERROR,
          category: ValidationCategory.NUMERIC_FORMAT,
          field: 'gridElectricity',
          message: 'Grid electricity cannot be negative',
          sourceTable: 'ElectricityData',
          sourceId: elec._id,
          value: String(elec.gridElectricity)
        });
      }

      // Check for outliers (>10x previous average would be flagged)
      const totalElec = (elec.gridElectricity || 0) + (elec.captiveElectricity || 0);
      if (totalElec > 10000000) { // 10 million kWh/month is unusual
        this.addError({
          severity: ValidationSeverity.WARNING,
          category: ValidationCategory.OUTLIER,
          field: 'totalElectricity',
          message: `Unusually high electricity consumption (${totalElec.toLocaleString()} kWh)`,
          sourceTable: 'ElectricityData',
          sourceId: elec._id,
          suggestion: 'Please verify this value is correct'
        });
      }
    }

    // Validate fuel data
    for (const f of fuel) {
      if (f.quantity < 0) {
        this.addError({
          severity: ValidationSeverity.ERROR,
          category: ValidationCategory.NUMERIC_FORMAT,
          field: 'quantity',
          message: `Fuel quantity cannot be negative for ${f.fuelName}`,
          sourceTable: 'FuelData',
          sourceId: f._id,
          value: String(f.quantity)
        });
      }

      if (!f.emissionFactor && !f.fuelType) {
        this.addError({
          severity: ValidationSeverity.WARNING,
          category: ValidationCategory.SUPPLIER_DATA,
          field: 'emissionFactor',
          message: `No emission factor set for fuel "${f.fuelName}"`,
          sourceTable: 'FuelData',
          sourceId: f._id,
          suggestion: 'System will attempt to match fuel to default emission factors'
        });
      }
    }

    // Validate production data
    for (const prod of production) {
      if (prod.quantityProduced <= 0) {
        this.addError({
          severity: ValidationSeverity.ERROR,
          category: ValidationCategory.NUMERIC_FORMAT,
          field: 'quantityProduced',
          message: `Production quantity must be positive for ${prod.productName}`,
          sourceTable: 'ProductionData',
          sourceId: prod._id,
          value: String(prod.quantityProduced)
        });
      }
    }

    // Validate precursor data
    for (const prec of precursor) {
      if (!prec.directEmissionFactor && !prec.indirectEmissionFactor) {
        this.addError({
          severity: ValidationSeverity.WARNING,
          category: ValidationCategory.SUPPLIER_DATA,
          field: 'emissionFactor',
          message: `No emission factors for precursor "${prec.materialName}" from ${prec.supplierName}`,
          sourceTable: 'PrecursorData',
          sourceId: prec._id,
          suggestion: 'CBAM default values will be used if available'
        });
      }
    }
  }

  private async validateSuppliers() {
    const suppliers = await Supplier.find({ organisation: this.orgId });

    for (const supplier of suppliers) {
      // Validate country code
      if (supplier.address?.countryCode) {
        if (!VALID_COUNTRY_CODES.has(supplier.address.countryCode.toUpperCase())) {
          this.addError({
            severity: ValidationSeverity.WARNING,
            category: ValidationCategory.COUNTRY_CODE,
            field: 'countryCode',
            message: `Country code "${supplier.address.countryCode}" for supplier "${supplier.name}" may not be recognized`,
            sourceTable: 'Supplier',
            sourceId: supplier._id,
            value: supplier.address.countryCode
          });
        }
      }

      // Check for declarations
      const declarationCount = await SupplierDeclaration.countDocuments({
        supplier: supplier._id,
        reportingPeriod: this.periodId
      });

      if (declarationCount === 0) {
        this.addError({
          severity: ValidationSeverity.INFO,
          category: ValidationCategory.SUPPLIER_DATA,
          field: 'declarations',
          message: `No emission declarations from supplier "${supplier.name}" for this period`,
          sourceTable: 'Supplier',
          sourceId: supplier._id,
          suggestion: 'Request emission data from supplier or use default values'
        });
      }
    }
  }

  private async validateCalculation() {
    if (!this.calculationId) return;

    const calculation = await Calculation.findById(this.calculationId);
    if (!calculation) return;

    // Check for zero emissions
    if (calculation.totalEmissions === 0) {
      this.addError({
        severity: ValidationSeverity.WARNING,
        category: ValidationCategory.CALCULATION,
        field: 'totalEmissions',
        message: 'Total emissions is zero - please verify all data is entered',
        sourceTable: 'Calculation',
        sourceId: calculation._id
      });
    }

    // Check for unrealistic SEE values
    for (const product of calculation.products) {
      if (product.seeTotal > 50) { // Very high SEE
        this.addError({
          severity: ValidationSeverity.WARNING,
          category: ValidationCategory.OUTLIER,
          field: 'seeTotal',
          message: `SEE of ${product.seeTotal.toFixed(3)} tCO2e/t for "${product.productName}" seems unusually high`,
          sourceTable: 'Calculation',
          suggestion: 'Verify production and emission data'
        });
      }

      if (product.seeTotal < 0.01 && product.productionQuantity > 0) {
        this.addError({
          severity: ValidationSeverity.WARNING,
          category: ValidationCategory.OUTLIER,
          field: 'seeTotal',
          message: `SEE of ${product.seeTotal.toFixed(3)} tCO2e/t for "${product.productName}" seems unusually low`,
          sourceTable: 'Calculation',
          suggestion: 'Verify all emission sources are included'
        });
      }
    }

    // Validate numeric precision (CBAM requires n..16,7 format)
    const checkPrecision = (value: number, field: string) => {
      const str = value.toString();
      const parts = str.split('.');
      const intPart = parts[0].replace('-', '');
      const decPart = parts[1] || '';
      
      if (intPart.length > 16 || decPart.length > 7) {
        this.addError({
          severity: ValidationSeverity.ERROR,
          category: ValidationCategory.NUMERIC_FORMAT,
          field,
          message: `Value ${value} exceeds CBAM numeric format (max 16 digits, 7 decimals)`,
          sourceTable: 'Calculation',
          value: str,
          suggestion: 'Round to maximum 7 decimal places'
        });
      }
    };

    checkPrecision(calculation.totalEmissions, 'totalEmissions');
    for (const product of calculation.products) {
      checkPrecision(product.seeTotal, 'seeTotal');
      checkPrecision(product.seeDirect, 'seeDirect');
      checkPrecision(product.seeIndirect, 'seeIndirect');
    }
  }

  private async validateCompleteness() {
    const filter = { organisation: this.orgId, reportingPeriod: this.periodId };

    // Check for production data
    const productionCount = await ProductionData.countDocuments(filter);
    if (productionCount === 0) {
      this.addError({
        severity: ValidationSeverity.ERROR,
        category: ValidationCategory.COMPLETENESS,
        field: 'production',
        message: 'No production data found for this reporting period',
        suggestion: 'Add production data before generating CBAM report'
      });
    }

    // Check for electricity data
    const electricityCount = await ElectricityData.countDocuments(filter);
    if (electricityCount === 0) {
      this.addError({
        severity: ValidationSeverity.WARNING,
        category: ValidationCategory.COMPLETENESS,
        field: 'electricity',
        message: 'No electricity consumption data found',
        suggestion: 'Add electricity data for accurate Scope 2 calculations'
      });
    }

    // Check all months are covered (quarters have 3 months)
    const electricity = await ElectricityData.find(filter).select('month');
    const monthsCovered = new Set(electricity.map(e => e.month));
    
    if (monthsCovered.size < 3) {
      this.addError({
        severity: ValidationSeverity.WARNING,
        category: ValidationCategory.COMPLETENESS,
        field: 'months',
        message: `Only ${monthsCovered.size} month(s) of data found (expected 3 for quarterly report)`,
        suggestion: 'Ensure all months in the quarter have data'
      });
    }
  }
}

export default ValidationEngine;

