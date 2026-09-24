import mongoose, { Schema, Document } from 'mongoose';

export interface ILeave extends Document {
  leaveId: number;
  empId: string;
  name: string;
  type: string;
  start: string;
  end: string;
  days: number;
  reason: string;
  reqDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reconsidered?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveSchema = new Schema<ILeave>({
  leaveId: { type: Number, required: true, unique: true },
  empId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
  days: { type: Number, required: true },
  reason: { type: String, required: true },
  reqDate: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  reconsidered: { type: Boolean, default: false },
}, {
  timestamps: true,
});

LeaveSchema.index({ empId: 1, status: 1 });

export default mongoose.models.Leave || mongoose.model<ILeave>('Leave', LeaveSchema);
