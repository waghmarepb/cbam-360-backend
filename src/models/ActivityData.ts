import mongoose, { Document, Schema } from 'mongoose';

export enum ActivityDataType {
  ELECTRICITY = 'electricity',
  FUEL = 'fuel',
  PRODUCTION = 'production',
  PRECURSOR = 'precursor'
}

// Base Activity Data
export interface IActivityData extends Document {
  _id: mongoose.Types.ObjectId;
  organisation: mongoose.Types.ObjectId;
  reportingPeriod: mongoose.Types.ObjectId;
  facility: mongoose.Types.ObjectId;
  type: ActivityDataType;
  month: number; // 1-12
  year: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Electricity Consumption
export interface IElectricityData extends IActivityData {
  gridElectricity: number; // kWh
  gridEmissionFactor?: number;
  renewableElectricity: number; // kWh
  captiveElectricity: number; // kWh (DG sets)
  captiveEmissionFactor?: number;
  captiveFuelType?: string;
  totalElectricity: number;
  calculatedEmissions?: number;
}

// Fuel Consumption
export interface IFuelData extends IActivityData {
  fuelType: mongoose.Types.ObjectId; // Reference to EmissionFactor
  fuelName: string;
  quantity: number;
  unit: string;
  emissionFactor?: number;
  calculatedEmissions?: number;
}

// Production Data
export interface IProductionData extends IActivityData {
  product: mongoose.Types.ObjectId;
  productName: string;
  quantityProduced: number;
  unit: string;
}

// Precursor/Raw Material Purchase
export interface IPrecursorData extends IActivityData {
  supplier?: mongoose.Types.ObjectId;
  supplierName: string;
  materialName: string;
  cnCode?: string;
  quantity: number;
  unit: string;
  directEmissionFactor?: number;
  indirectEmissionFactor?: number;
  emissionFactorSource: 'supplier' | 'default' | 'manual';
  calculatedDirectEmissions?: number;
  calculatedIndirectEmissions?: number;
}

// Electricity Schema
const electricityDataSchema = new Schema<IElectricityData>(
  {
    organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
    reportingPeriod: { type: Schema.Types.ObjectId, ref: 'ReportingPeriod', required: true },
    facility: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
    type: { type: String, default: ActivityDataType.ELECTRICITY },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    gridElectricity: { type: Number, required: true, min: 0, default: 0 },
    gridEmissionFactor: { type: Number, min: 0 },
    renewableElectricity: { type: Number, min: 0, default: 0 },
    captiveElectricity: { type: Number, min: 0, default: 0 },
    captiveEmissionFactor: { type: Number, min: 0 },
    captiveFuelType: { type: String },
    totalElectricity: { type: Number, min: 0 },
    calculatedEmissions: { type: Number, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

electricityDataSchema.index({ organisation: 1, reportingPeriod: 1, facility: 1, month: 1, year: 1 }, { unique: true });

electricityDataSchema.pre('save', function(next) {
  this.totalElectricity = (this.gridElectricity || 0) + (this.renewableElectricity || 0) + (this.captiveElectricity || 0);
  next();
});

// Fuel Schema
const fuelDataSchema = new Schema<IFuelData>(
  {
    organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
    reportingPeriod: { type: Schema.Types.ObjectId, ref: 'ReportingPeriod', required: true },
    facility: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
    type: { type: String, default: ActivityDataType.FUEL },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    fuelType: { type: Schema.Types.ObjectId, ref: 'EmissionFactor' },
    fuelName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, default: 'kg' },
    emissionFactor: { type: Number, min: 0 },
    calculatedEmissions: { type: Number, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

fuelDataSchema.index({ organisation: 1, reportingPeriod: 1, facility: 1, month: 1, fuelName: 1 });

// Production Schema
const productionDataSchema = new Schema<IProductionData>(
  {
    organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
    reportingPeriod: { type: Schema.Types.ObjectId, ref: 'ReportingPeriod', required: true },
    facility: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
    type: { type: String, default: ActivityDataType.PRODUCTION },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantityProduced: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, default: 'tonnes' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

productionDataSchema.index({ organisation: 1, reportingPeriod: 1, facility: 1, product: 1, month: 1 }, { unique: true });

// Precursor Schema
const precursorDataSchema = new Schema<IPrecursorData>(
  {
    organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
    reportingPeriod: { type: Schema.Types.ObjectId, ref: 'ReportingPeriod', required: true },
    facility: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
    type: { type: String, default: ActivityDataType.PRECURSOR },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    supplierName: { type: String, required: true },
    materialName: { type: String, required: true },
    cnCode: { type: String },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, default: 'tonnes' },
    directEmissionFactor: { type: Number, min: 0 },
    indirectEmissionFactor: { type: Number, min: 0 },
    emissionFactorSource: { 
      type: String, 
      enum: ['supplier', 'default', 'manual'],
      default: 'manual'
    },
    calculatedDirectEmissions: { type: Number, min: 0 },
    calculatedIndirectEmissions: { type: Number, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

precursorDataSchema.index({ organisation: 1, reportingPeriod: 1, facility: 1, month: 1 });

export const ElectricityData = mongoose.model<IElectricityData>('ElectricityData', electricityDataSchema);
export const FuelData = mongoose.model<IFuelData>('FuelData', fuelDataSchema);
export const ProductionData = mongoose.model<IProductionData>('ProductionData', productionDataSchema);
export const PrecursorData = mongoose.model<IPrecursorData>('PrecursorData', precursorDataSchema);

