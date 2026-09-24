import CompanySettings, { ICompanySettings } from '../models/CompanySettings';
import { isMongoConfigured } from '../config/db';
import { SettingsLike } from './attendanceStatus';

export const DEFAULT_SETTINGS: ICompanySettings['_doc'] = {
  companyName: 'StaffSync',
  companyEmail: 'hr@attendtrack.com',
  companyAddress: '123 Business Ave, Makati City',
  workStartTime: '09:00',
  workEndTime: '18:00',
  leaveAllowance: 14,
  workWeek: 'Monday – Friday',
  lateBuffer: 15,
  overtimeBuffer: 30,
  customDepartments: [] as string[],
};

export async function getCompanySettings(): Promise<SettingsLike & { leaveAllowance: number; workWeek: string; companyName: string; companyEmail: string; companyAddress: string; customDepartments: string[] }> {
  const defaults = { ...DEFAULT_SETTINGS };
  if (!isMongoConfigured()) return defaults;
  try {
    let doc = await CompanySettings.findOne().sort({ updatedAt: -1 });
    if (!doc) {
      doc = await CompanySettings.create({ ...defaults });
    }
    const plain = (doc?.toObject?.() ?? (doc as any) ?? defaults);
    return {
      companyName: String(plain.companyName ?? defaults.companyName),
      companyEmail: String(plain.companyEmail ?? defaults.companyEmail),
      companyAddress: String(plain.companyAddress ?? defaults.companyAddress),
      workStartTime: String(plain.workStartTime ?? defaults.workStartTime),
      workEndTime: String(plain.workEndTime ?? defaults.workEndTime),
      leaveAllowance: Number.isFinite(+plain.leaveAllowance) ? Math.max(1, +plain.leaveAllowance) : defaults.leaveAllowance,
      workWeek: String(plain.workWeek ?? defaults.workWeek),
      lateBuffer: Number.isFinite(+plain.lateBuffer) ? Math.max(0, +plain.lateBuffer) : defaults.lateBuffer,
      overtimeBuffer: Number.isFinite(+plain.overtimeBuffer) ? Math.max(0, +plain.overtimeBuffer) : defaults.overtimeBuffer,
      customDepartments: Array.isArray(plain.customDepartments) ? plain.customDepartments.map(String) : [],
    };
  } catch {
    return defaults;
  }
}
