import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  attId: number;
  empId: string;
  name: string;
  dept: string;
  date: string;
  clockIn: string;
  clockOut: string;
  officeHours: string;
  fieldHours: string;
  status: string;
  mode: 'Office' | 'WFH';
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>({
  attId: { type: Number, required: true, unique: true },
  empId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  dept: { type: String, required: true },
  date: { type: String, required: true },
  clockIn: { type: String, default: '—' },
  clockOut: { type: String, default: '—' },
  officeHours: { type: String, default: '—' },
  fieldHours: { type: String, default: '—' },
  status: { type: String, required: true, default: 'Present' },
  mode: { type: String, enum: ['Office', 'WFH'], default: 'Office' },
}, {
  timestamps: true,
});

AttendanceSchema.index({ empId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1 });

export default mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);
