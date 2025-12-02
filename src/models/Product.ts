import mongoose, { Document, Schema } from 'mongoose';

export enum ProductUnit {
  TONNES = 'tonnes',
  KILOGRAMS = 'kilograms',
  METERS = 'meters',
  PIECES = 'pieces',
  MWH = 'MWh'
}

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  organisation: mongoose.Types.ObjectId;
  name: string;
  productCode?: string;
  cnCode: string;
  cnCodeRef?: mongoose.Types.ObjectId;
  description?: string;
  unit: ProductUnit;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    organisation: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation is required']
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters']
    },
    productCode: {
      type: String,
      trim: true
    },
    cnCode: {
      type: String,
      required: [true, 'CN code is required'],
      trim: true,
      match: [/^\d{8}$/, 'CN code must be exactly 8 digits']
    },
    cnCodeRef: {
      type: Schema.Types.ObjectId,
      ref: 'CNCode'
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    unit: {
      type: String,
      enum: Object.values(ProductUnit),
      default: ProductUnit.TONNES
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
productSchema.index({ organisation: 1 });
productSchema.index({ cnCode: 1 });
productSchema.index({ name: 'text', productCode: 'text' });

// Compound index for unique product per org
productSchema.index({ organisation: 1, name: 1 }, { unique: true });

const Product = mongoose.model<IProduct>('Product', productSchema);

export default Product;

