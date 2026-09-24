import mongoose, { Schema, Document } from 'mongoose';

export interface ICompanySettings extends Document {
  companyName: string;
  companyEmail: string;
  companyAddress: string;
  workStartTime: string;
  workEndTime: string;
  leaveAllowance: number;
  workWeek: string;
  lateBuffer: number;
  overtimeBuffer: number;
  customDepartments: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CompanySettingsSchema = new Schema<ICompanySettings>({
  companyName: { type: String, required: true, default: 'StaffSync' },
  companyEmail: { type: String, required: true, default: 'hr@attendtrack.com' },
  companyAddress: { type: String, required: true, default: '123 Business Ave, Makati City' },
  workStartTime: { type: String, required: true, default: '09:00' },
  workEndTime: { type: String, required: true, default: '18:00' },
  leaveAllowance: { type: Number, required: true, default: 14 },
  workWeek: { type: String, required: true, default: 'Monday – Friday' },
  lateBuffer: { type: Number, required: true, default: 15 },
  overtimeBuffer: { type: Number, required: true, default: 30 },
  customDepartments: { type: [String], required: true, default: [] },
}, {
  timestamps: true,
});

export default mongoose.models.CompanySettings || mongoose.model<ICompanySettings>('CompanySettings', CompanySettingsSchema);
