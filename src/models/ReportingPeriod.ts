import mongoose, { Document, Schema } from 'mongoose';

export enum Quarter {
  Q1 = 'Q1',
  Q2 = 'Q2',
  Q3 = 'Q3',
  Q4 = 'Q4'
}

export enum ReportingStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  PENDING_REVIEW = 'pending_review',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface IReportingPeriod extends Document {
  _id: mongoose.Types.ObjectId;
  organisation: mongoose.Types.ObjectId;
  year: number;
  quarter: Quarter;
  status: ReportingStatus;
  startDate: Date;
  endDate: Date;
  submittedAt?: Date;
  submittedBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reportingPeriodSchema = new Schema<IReportingPeriod>(
  {
    organisation: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation is required']
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [2023, 'Year must be 2023 or later'],
      max: [2100, 'Year cannot exceed 2100']
    },
    quarter: {
      type: String,
      enum: Object.values(Quarter),
      required: [true, 'Quarter is required']
    },
    status: {
      type: String,
      enum: Object.values(ReportingStatus),
      default: ReportingStatus.DRAFT
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    submittedAt: {
      type: Date
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
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

// Compound unique index - one reporting period per org per quarter
reportingPeriodSchema.index({ organisation: 1, year: 1, quarter: 1 }, { unique: true });

// Virtual for period display name
reportingPeriodSchema.virtual('displayName').get(function (this: IReportingPeriod) {
  return `${this.quarter} ${this.year}`;
});

// Pre-save hook to calculate start and end dates based on quarter
reportingPeriodSchema.pre('save', function (next) {
  if (this.isModified('year') || this.isModified('quarter')) {
    const year = this.year;
    
    switch (this.quarter) {
      case Quarter.Q1:
        this.startDate = new Date(year, 0, 1); // Jan 1
        this.endDate = new Date(year, 2, 31); // Mar 31
        break;
      case Quarter.Q2:
        this.startDate = new Date(year, 3, 1); // Apr 1
        this.endDate = new Date(year, 5, 30); // Jun 30
        break;
      case Quarter.Q3:
        this.startDate = new Date(year, 6, 1); // Jul 1
        this.endDate = new Date(year, 8, 30); // Sep 30
        break;
      case Quarter.Q4:
        this.startDate = new Date(year, 9, 1); // Oct 1
        this.endDate = new Date(year, 11, 31); // Dec 31
        break;
    }
  }
  next();
});

const ReportingPeriod = mongoose.model<IReportingPeriod>('ReportingPeriod', reportingPeriodSchema);

export default ReportingPeriod;

