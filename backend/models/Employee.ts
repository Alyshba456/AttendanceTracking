import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployeeRemark {
  text: string;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
}

export interface IEmployee extends Document {
  id: string;
  name: string;
  email: string;
  dept: string;
  designation: string;
  role: 'Admin' | 'Employee';
  status: 'Active' | 'Inactive';
  tempPassword: string;
  password: string;
  firstLogin: boolean;
  remarks: string;
  remarksHistory: IEmployeeRemark[];
  createdAt: Date;
  updatedAt: Date;
}

const RemarkSchema = new Schema<IEmployeeRemark>({
  text: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
  createdBy: { type: String, required: true },
  updatedAt: { type: Date },
}, { _id: true });

const EmployeeSchema = new Schema<IEmployee>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  dept: { type: String, required: true },
  designation: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Employee'], default: 'Employee' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  tempPassword: { type: String, default: '' },
  password: { type: String, required: true },
  firstLogin: { type: Boolean, default: true },
  remarks: { type: String, default: '' },
  remarksHistory: { type: [RemarkSchema], default: () => [] },
}, {
  timestamps: true,
});

export default mongoose.models.Employee || mongoose.model<IEmployee>('Employee', EmployeeSchema);
