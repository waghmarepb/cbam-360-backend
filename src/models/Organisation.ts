import mongoose, { Document, Schema } from 'mongoose';

export enum OrganisationType {
  EU_IMPORTER = 'eu_importer',
  NON_EU_PRODUCER = 'non_eu_producer'
}

export interface IAddress {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  countryCode: string;
}

export interface IOrganisation extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: OrganisationType;
  registrationNumber?: string;
  vatNumber?: string;
  address: IAddress;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  logo?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true
    },
    countryCode: {
      type: String,
      required: [true, 'Country code is required'],
      uppercase: true,
      minlength: 2,
      maxlength: 2
    }
  },
  { _id: false }
);

const organisationSchema = new Schema<IOrganisation>(
  {
    name: {
      type: String,
      required: [true, 'Organisation name is required'],
      trim: true,
      maxlength: [200, 'Organisation name cannot exceed 200 characters']
    },
    type: {
      type: String,
      enum: Object.values(OrganisationType),
      required: [true, 'Organisation type is required']
    },
    registrationNumber: {
      type: String,
      trim: true
    },
    vatNumber: {
      type: String,
      trim: true
    },
    address: {
      type: addressSchema,
      required: [true, 'Address is required']
    },
    contactEmail: {
      type: String,
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    contactPhone: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true
    },
    logo: {
      type: String
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

// Index for faster lookups
organisationSchema.index({ name: 1 });
organisationSchema.index({ 'address.countryCode': 1 });

const Organisation = mongoose.model<IOrganisation>('Organisation', organisationSchema);

export default Organisation;

