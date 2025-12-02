import mongoose, { Document, Schema } from 'mongoose';
import { IAddress } from './Organisation';

export interface IFacility extends Document {
  _id: mongoose.Types.ObjectId;
  organisation: mongoose.Types.ObjectId;
  name: string;
  facilityCode?: string;
  address: IAddress;
  description?: string;
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

const facilitySchema = new Schema<IFacility>(
  {
    organisation: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation is required']
    },
    name: {
      type: String,
      required: [true, 'Facility name is required'],
      trim: true,
      maxlength: [200, 'Facility name cannot exceed 200 characters']
    },
    facilityCode: {
      type: String,
      trim: true
    },
    address: {
      type: addressSchema,
      required: [true, 'Address is required']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
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
facilitySchema.index({ organisation: 1 });
facilitySchema.index({ name: 1 });

const Facility = mongoose.model<IFacility>('Facility', facilitySchema);

export default Facility;

