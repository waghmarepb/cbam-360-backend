import mongoose, { Document, Schema } from 'mongoose';

export enum CBAMCategory {
  IRON_STEEL = 'iron_steel',
  ALUMINIUM = 'aluminium',
  CEMENT = 'cement',
  FERTILIZERS = 'fertilizers',
  ELECTRICITY = 'electricity',
  HYDROGEN = 'hydrogen'
}

export interface ICNCode extends Document {
  _id: mongoose.Types.ObjectId;
  code: string;
  description: string;
  category: CBAMCategory;
  subcategory?: string;
  unit: string;
  cbamApplicable: boolean;
  defaultEmissionFactor?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const cnCodeSchema = new Schema<ICNCode>(
  {
    code: {
      type: String,
      required: [true, 'CN code is required'],
      unique: true,
      trim: true,
      match: [/^\d{8}$/, 'CN code must be exactly 8 digits']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true
    },
    category: {
      type: String,
      enum: Object.values(CBAMCategory),
      required: [true, 'Category is required']
    },
    subcategory: {
      type: String,
      trim: true
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      default: 'tonnes'
    },
    cbamApplicable: {
      type: Boolean,
      default: true
    },
    defaultEmissionFactor: {
      type: Number,
      min: 0
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
cnCodeSchema.index({ code: 1 });
cnCodeSchema.index({ category: 1 });
cnCodeSchema.index({ description: 'text' });

const CNCode = mongoose.model<ICNCode>('CNCode', cnCodeSchema);

export default CNCode;

