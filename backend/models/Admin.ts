import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
  id: 'ADMIN';
  name: string;
  email: string;
  password: string;
  role: 'Admin';
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema = new Schema<IAdmin>({
  id: { type: String, required: true, unique: true, default: 'ADMIN', enum: ['ADMIN'] },
  name: { type: String, required: true, default: 'Admin User' },
  email: { type: String, required: true, unique: true, lowercase: true, default: 'admin@company.com' },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['Admin'], default: 'Admin' },
}, {
  timestamps: true,
});

export default mongoose.models.Admin || mongoose.model<IAdmin>('Admin', AdminSchema);
