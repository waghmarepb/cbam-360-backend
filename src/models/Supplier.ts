import mongoose, { Document, Schema } from 'mongoose';

export enum SupplierStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  INACTIVE = 'inactive'
}

export enum DeclarationStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

export interface ISupplier extends Document {
  _id: mongoose.Types.ObjectId;
  organisation: mongoose.Types.ObjectId;
  name: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country: string;
    countryCode: string;
  };
  status: SupplierStatus;
  invitationToken?: string;
  invitationSentAt?: Date;
  lastDeclarationAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISupplierDeclaration extends Document {
  _id: mongoose.Types.ObjectId;
  organisation: mongoose.Types.ObjectId;
  supplier: mongoose.Types.ObjectId;
  reportingPeriod: mongoose.Types.ObjectId;
  // Product/Material Details
  productName: string;
  cnCode?: string;
  productionRoute?: string;
  // Emission Factors
  directEmissionFactor: number;
  indirectEmissionFactor: number;
  totalEmissionFactor: number;
  unit: string;
  // Supporting Data
  productionQuantity?: number;
  totalDirectEmissions?: number;
  totalIndirectEmissions?: number;
  electricitySource?: string;
  electricityEmissionFactor?: number;
  // Verification
  status: DeclarationStatus;
  documentPath?: string;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  rejectionReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Supplier Schema
const supplierSchema = new Schema<ISupplier>(
  {
    organisation: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation is required']
    },
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters']
    },
    contactPerson: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: {
        type: String,
        required: [true, 'Country is required']
      },
      countryCode: {
        type: String,
        required: [true, 'Country code is required'],
        uppercase: true,
        minlength: 2,
        maxlength: 2
      }
    },
    status: {
      type: String,
      enum: Object.values(SupplierStatus),
      default: SupplierStatus.ACTIVE
    },
    invitationToken: {
      type: String,
      select: false
    },
    invitationSentAt: Date,
    lastDeclarationAt: Date,
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
supplierSchema.index({ organisation: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ organisation: 1, name: 1 }, { unique: true });

// Virtual for declaration count
supplierSchema.virtual('declarations', {
  ref: 'SupplierDeclaration',
  localField: '_id',
  foreignField: 'supplier',
  count: true
});

// Supplier Declaration Schema
const supplierDeclarationSchema = new Schema<ISupplierDeclaration>(
  {
    organisation: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier is required']
    },
    reportingPeriod: {
      type: Schema.Types.ObjectId,
      ref: 'ReportingPeriod',
      required: [true, 'Reporting period is required']
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    cnCode: {
      type: String,
      trim: true,
      match: [/^\d{8}$/, 'CN code must be 8 digits']
    },
    productionRoute: {
      type: String,
      trim: true
    },
    directEmissionFactor: {
      type: Number,
      required: [true, 'Direct emission factor is required'],
      min: [0, 'Emission factor must be positive']
    },
    indirectEmissionFactor: {
      type: Number,
      required: [true, 'Indirect emission factor is required'],
      min: [0, 'Emission factor must be positive']
    },
    totalEmissionFactor: {
      type: Number,
      min: 0
    },
    unit: {
      type: String,
      default: 'tCO2e/t'
    },
    productionQuantity: {
      type: Number,
      min: 0
    },
    totalDirectEmissions: {
      type: Number,
      min: 0
    },
    totalIndirectEmissions: {
      type: Number,
      min: 0
    },
    electricitySource: {
      type: String,
      trim: true
    },
    electricityEmissionFactor: {
      type: Number,
      min: 0
    },
    status: {
      type: String,
      enum: Object.values(DeclarationStatus),
      default: DeclarationStatus.PENDING
    },
    documentPath: String,
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    rejectionReason: {
      type: String,
      trim: true
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
supplierDeclarationSchema.index({ organisation: 1, supplier: 1, reportingPeriod: 1 });
supplierDeclarationSchema.index({ supplier: 1 });
supplierDeclarationSchema.index({ status: 1 });

// Pre-save hook to calculate total EF
supplierDeclarationSchema.pre('save', function(next) {
  this.totalEmissionFactor = (this.directEmissionFactor || 0) + (this.indirectEmissionFactor || 0);
  next();
});

export const Supplier = mongoose.model<ISupplier>('Supplier', supplierSchema);
export const SupplierDeclaration = mongoose.model<ISupplierDeclaration>('SupplierDeclaration', supplierDeclarationSchema);

