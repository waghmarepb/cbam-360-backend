import mongoose, { Document, Schema } from 'mongoose';

export enum ReportType {
  CBAM_XML = 'cbam_xml',
  SUMMARY_PDF = 'summary_pdf',
  DETAILED_PDF = 'detailed_pdf',
  EXCEL_EXPORT = 'excel_export'
}

export enum ReportStatus {
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  VALIDATED = 'validated',
  SUBMITTED = 'submitted'
}

export interface IXMLValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IReport extends Document {
  _id: mongoose.Types.ObjectId;
  organisation: mongoose.Types.ObjectId;
  reportingPeriod: mongoose.Types.ObjectId;
  calculation: mongoose.Types.ObjectId;
  
  type: ReportType;
  status: ReportStatus;
  
  // File details
  fileName: string;
  filePath?: string;
  fileSize?: number;
  mimeType: string;
  
  // XML specific
  xmlContent?: string;
  xsdVersion?: string;
  validationResult?: IXMLValidationResult;
  
  // Metadata
  generatedAt: Date;
  generatedBy: mongoose.Types.ObjectId;
  submittedAt?: Date;
  
  // Error tracking
  errorMessage?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const xmlValidationResultSchema = new Schema<IXMLValidationResult>(
  {
    isValid: { type: Boolean, required: true },
    errors: [{ type: String }],
    warnings: [{ type: String }]
  },
  { _id: false }
);

const reportSchema = new Schema<IReport>(
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
      ref: 'Calculation',
      required: true
    },
    
    type: {
      type: String,
      enum: Object.values(ReportType),
      required: true
    },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.GENERATING
    },
    
    fileName: { type: String, required: true },
    filePath: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String, required: true },
    
    xmlContent: { type: String },
    xsdVersion: { type: String, default: '23.00' },
    validationResult: xmlValidationResultSchema,
    
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    
    errorMessage: { type: String }
  },
  {
    timestamps: true
  }
);

// Indexes
reportSchema.index({ organisation: 1, reportingPeriod: 1 });
reportSchema.index({ type: 1, status: 1 });
reportSchema.index({ generatedAt: -1 });

const Report = mongoose.model<IReport>('Report', reportSchema);

export default Report;

