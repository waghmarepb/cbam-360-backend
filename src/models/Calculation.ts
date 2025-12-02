import mongoose, { Document, Schema } from 'mongoose';

export enum CalculationStatus {
  DRAFT = 'draft',
  CALCULATED = 'calculated',
  VALIDATED = 'validated',
  FINALIZED = 'finalized'
}

// Scope breakdown detail
export interface IScopeDetail {
  source: string;
  sourceId?: mongoose.Types.ObjectId;
  quantity: number;
  unit: string;
  emissionFactor: number;
  emissionFactorUnit: string;
  emissions: number;
}

// Product-level calculation
export interface IProductCalculation {
  product: mongoose.Types.ObjectId;
  productName: string;
  cnCode: string;
  productionQuantity: number;
  productionUnit: string;
  
  // Scope 1 - Direct (Fuel)
  scope1Emissions: number;
  scope1Details: IScopeDetail[];
  
  // Scope 2 - Indirect (Electricity)
  scope2Emissions: number;
  scope2Details: IScopeDetail[];
  
  // Scope 3 - Precursors
  scope3DirectEmissions: number;
  scope3IndirectEmissions: number;
  scope3TotalEmissions: number;
  scope3Details: IScopeDetail[];
  
  // Totals
  totalEmissions: number;
  
  // SEE (Specific Embedded Emissions)
  seeTotal: number;
  seeDirect: number;
  seeIndirect: number;
}

export interface ICalculation extends Document {
  _id: mongoose.Types.ObjectId;
  organisation: mongoose.Types.ObjectId;
  reportingPeriod: mongoose.Types.ObjectId;
  facility?: mongoose.Types.ObjectId;
  
  // Overall Summary
  totalScope1: number;
  totalScope2: number;
  totalScope3Direct: number;
  totalScope3Indirect: number;
  totalScope3: number;
  totalEmissions: number;
  totalProduction: number;
  
  // Product-level calculations
  products: IProductCalculation[];
  
  // Metadata
  status: CalculationStatus;
  calculatedAt: Date;
  calculatedBy: mongoose.Types.ObjectId;
  finalizedAt?: Date;
  finalizedBy?: mongoose.Types.ObjectId;
  notes?: string;
  
  // Audit trail
  version: number;
  previousVersion?: mongoose.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const scopeDetailSchema = new Schema<IScopeDetail>(
  {
    source: { type: String, required: true },
    sourceId: { type: Schema.Types.ObjectId },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    emissionFactor: { type: Number, required: true },
    emissionFactorUnit: { type: String, required: true },
    emissions: { type: Number, required: true }
  },
  { _id: false }
);

const productCalculationSchema = new Schema<IProductCalculation>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    cnCode: { type: String, required: true },
    productionQuantity: { type: Number, required: true, min: 0 },
    productionUnit: { type: String, default: 'tonnes' },
    
    scope1Emissions: { type: Number, default: 0 },
    scope1Details: [scopeDetailSchema],
    
    scope2Emissions: { type: Number, default: 0 },
    scope2Details: [scopeDetailSchema],
    
    scope3DirectEmissions: { type: Number, default: 0 },
    scope3IndirectEmissions: { type: Number, default: 0 },
    scope3TotalEmissions: { type: Number, default: 0 },
    scope3Details: [scopeDetailSchema],
    
    totalEmissions: { type: Number, default: 0 },
    
    seeTotal: { type: Number, default: 0 },
    seeDirect: { type: Number, default: 0 },
    seeIndirect: { type: Number, default: 0 }
  },
  { _id: false }
);

const calculationSchema = new Schema<ICalculation>(
  {
    organisation: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true
    },
    reportingPeriod: {
      type: Schema.Types.ObjectId,
      ref: 'ReportingPeriod',
      required: true
    },
    facility: {
      type: Schema.Types.ObjectId,
      ref: 'Facility'
    },
    
    totalScope1: { type: Number, default: 0 },
    totalScope2: { type: Number, default: 0 },
    totalScope3Direct: { type: Number, default: 0 },
    totalScope3Indirect: { type: Number, default: 0 },
    totalScope3: { type: Number, default: 0 },
    totalEmissions: { type: Number, default: 0 },
    totalProduction: { type: Number, default: 0 },
    
    products: [productCalculationSchema],
    
    status: {
      type: String,
      enum: Object.values(CalculationStatus),
      default: CalculationStatus.DRAFT
    },
    calculatedAt: { type: Date },
    calculatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    finalizedAt: { type: Date },
    finalizedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    
    version: { type: Number, default: 1 },
    previousVersion: { type: Schema.Types.ObjectId, ref: 'Calculation' }
  },
  {
    timestamps: true
  }
);

// Indexes
calculationSchema.index({ organisation: 1, reportingPeriod: 1 });
calculationSchema.index({ status: 1 });

const Calculation = mongoose.model<ICalculation>('Calculation', calculationSchema);

export default Calculation;

