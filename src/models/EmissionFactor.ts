import mongoose, { Document, Schema } from 'mongoose';

export enum EmissionFactorType {
  FUEL = 'fuel',
  ELECTRICITY = 'electricity',
  PRECURSOR = 'precursor',
  DEFAULT = 'default'
}

export enum FuelCategory {
  SOLID = 'solid',
  LIQUID = 'liquid',
  GASEOUS = 'gaseous'
}

export interface IEmissionFactor extends Document {
  _id: mongoose.Types.ObjectId;
  organisation?: mongoose.Types.ObjectId; // null for global/default factors
  type: EmissionFactorType;
  name: string;
  code?: string;
  category?: string;
  subcategory?: string;
  emissionFactor: number;
  unit: string;
  sourceUnit: string;
  countryCode?: string;
  source: string;
  year?: number;
  validFrom?: Date;
  validTo?: Date;
  isDefault: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const emissionFactorSchema = new Schema<IEmissionFactor>(
  {
    organisation: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      default: null
    },
    type: {
      type: String,
      enum: Object.values(EmissionFactorType),
      required: [true, 'Type is required']
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    code: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      trim: true
    },
    subcategory: {
      type: String,
      trim: true
    },
    emissionFactor: {
      type: Number,
      required: [true, 'Emission factor value is required'],
      min: [0, 'Emission factor must be positive']
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      default: 'tCO2e/unit'
    },
    sourceUnit: {
      type: String,
      required: [true, 'Source unit is required'],
      default: 'tonne'
    },
    countryCode: {
      type: String,
      uppercase: true,
      minlength: 2,
      maxlength: 2
    },
    source: {
      type: String,
      required: [true, 'Source is required'],
      trim: true
    },
    year: {
      type: Number,
      min: 2000,
      max: 2100
    },
    validFrom: {
      type: Date
    },
    validTo: {
      type: Date
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
emissionFactorSchema.index({ type: 1 });
emissionFactorSchema.index({ organisation: 1 });
emissionFactorSchema.index({ countryCode: 1 });
emissionFactorSchema.index({ isDefault: 1 });
emissionFactorSchema.index({ name: 'text', code: 'text' });

const EmissionFactor = mongoose.model<IEmissionFactor>('EmissionFactor', emissionFactorSchema);

export default EmissionFactor;

