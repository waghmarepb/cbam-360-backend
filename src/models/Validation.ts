import mongoose, { Document, Schema } from 'mongoose';

export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export enum ValidationCategory {
  CN_CODE = 'cn_code',
  COUNTRY_CODE = 'country_code',
  NUMERIC_FORMAT = 'numeric_format',
  REQUIRED_FIELD = 'required_field',
  DATE_RANGE = 'date_range',
  SUPPLIER_DATA = 'supplier_data',
  OUTLIER = 'outlier',
  COMPLETENESS = 'completeness',
  CALCULATION = 'calculation'
}

export interface IValidationError {
  severity: ValidationSeverity;
  category: ValidationCategory;
  field: string;
  message: string;
  sourceTable?: string;
  sourceId?: mongoose.Types.ObjectId;
  value?: string;
  suggestion?: string;
}

export interface IValidationResult extends Document {
  _id: mongoose.Types.ObjectId;
  organisation: mongoose.Types.ObjectId;
  reportingPeriod: mongoose.Types.ObjectId;
  calculation?: mongoose.Types.ObjectId;
  
  // Summary
  status: 'passed' | 'failed' | 'warnings';
  errorCount: number;
  warningCount: number;
  infoCount: number;
  
  // Detailed errors
  errors: IValidationError[];
  
  // Validation metadata
  validatedAt: Date;
  validatedBy: mongoose.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const validationErrorSchema = new Schema<IValidationError>(
  {
    severity: {
      type: String,
      enum: Object.values(ValidationSeverity),
      required: true
    },
    category: {
      type: String,
      enum: Object.values(ValidationCategory),
      required: true
    },
    field: { type: String, required: true },
    message: { type: String, required: true },
    sourceTable: { type: String },
    sourceId: { type: Schema.Types.ObjectId },
    value: { type: String },
    suggestion: { type: String }
  },
  { _id: false }
);

const validationResultSchema = new Schema<IValidationResult>(
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
    calculation: {
      type: Schema.Types.ObjectId,
      ref: 'Calculation'
    },
    
    status: {
      type: String,
      enum: ['passed', 'failed', 'warnings'],
      default: 'passed'
    },
    errorCount: { type: Number, default: 0 },
    warningCount: { type: Number, default: 0 },
    infoCount: { type: Number, default: 0 },
    
    errors: [validationErrorSchema],
    
    validatedAt: { type: Date, default: Date.now },
    validatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true
  }
);

// Indexes
validationResultSchema.index({ organisation: 1, reportingPeriod: 1 });

const ValidationResult = mongoose.model<IValidationResult>('ValidationResult', validationResultSchema);

export default ValidationResult;

