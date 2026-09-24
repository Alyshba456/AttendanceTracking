import mongoose, { Schema, Document } from 'mongoose';

export interface IFieldWork extends Document {
  fwId: number;
  empId: string;
  name: string;
  date: string;
  location: string;
  start: string;
  end: string;
  hours: string;
  desc: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: Date;
  updatedAt: Date;
}

const FieldWorkSchema = new Schema<IFieldWork>({
  fwId: { type: Number, required: true, unique: true },
  empId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  date: { type: String, required: true },
  location: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
  hours: { type: String, required: true },
  desc: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
}, {
  timestamps: true,
});

FieldWorkSchema.index({ empId: 1, date: 1 });

export default mongoose.models.FieldWork || mongoose.model<IFieldWork>('FieldWork', FieldWorkSchema);
