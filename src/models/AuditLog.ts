import mongoose, { Document, Schema } from 'mongoose';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  EXPORT = 'export',
  IMPORT = 'import',
  CALCULATE = 'calculate',
  VALIDATE = 'validate',
  GENERATE_REPORT = 'generate_report',
  FINALIZE = 'finalize'
}

export enum AuditResource {
  USER = 'user',
  ORGANISATION = 'organisation',
  FACILITY = 'facility',
  PRODUCT = 'product',
  SUPPLIER = 'supplier',
  ACTIVITY_DATA = 'activity_data',
  EMISSION_FACTOR = 'emission_factor',
  CALCULATION = 'calculation',
  VALIDATION = 'validation',
  REPORT = 'report',
  REPORTING_PERIOD = 'reporting_period'
}

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  organisation: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: mongoose.Types.ObjectId;
  resourceName?: string;
  
  // Details
  description: string;
  changes?: {
    field: string;
    oldValue?: string;
    newValue?: string;
  }[];
  metadata?: Record<string, unknown>;
  
  // Request info
  ipAddress?: string;
  userAgent?: string;
  
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    organisation: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true
    },
    resource: {
      type: String,
      enum: Object.values(AuditResource),
      required: true
    },
    resourceId: { type: Schema.Types.ObjectId },
    resourceName: { type: String },
    
    description: { type: String, required: true },
    changes: [{
      field: { type: String },
      oldValue: { type: String },
      newValue: { type: String }
    }],
    metadata: { type: Schema.Types.Mixed },
    
    ipAddress: { type: String },
    userAgent: { type: String }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes for efficient querying
auditLogSchema.index({ organisation: 1, createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ action: 1 });

const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;

