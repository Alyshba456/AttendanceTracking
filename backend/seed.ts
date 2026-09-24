import { connectDB } from './config/db';
import Employee from './models/Employee';
import Leave from './models/Leave';
import FieldWork from './models/FieldWork';
import Attendance from './models/Attendance';
import CompanySettings from './models/CompanySettings';
import Admin from './models/Admin';
import { hashPw } from './utils/auth';

const defaultSettings = {
  companyName: 'StaffSync',
  companyEmail: 'hr@attendtrack.com',
  companyAddress: '123 Business Ave, Makati City',
  workStartTime: '09:00',
  workEndTime: '18:00',
  leaveAllowance: 14,
  workWeek: 'Monday – Friday',
  lateBuffer: 15,
  overtimeBuffer: 30,
};

export async function seedDatabase() {
  await connectDB();

  const adminCount = await Admin.countDocuments();
  if (adminCount === 0) {
    await Admin.create({
      id: 'ADMIN',
      name: 'Admin User',
      email: 'admin@company.com',
      password: hashPw('Admin@Sync0!'),
      role: 'Admin',
    });
    console.log('Seeded admin');
  }

  const empCount = await Employee.countDocuments();
  console.log(`Employees: ${empCount} (leaving empty — add via Employees tab)`);

  const leaveCount = await Leave.countDocuments();
  console.log(`Leaves: ${leaveCount}`);

  const fwCount = await FieldWork.countDocuments();
  console.log(`Field Work: ${fwCount}`);

  const attCount = await Attendance.countDocuments();
  console.log(`Attendance: ${attCount}`);

  const setCount = await CompanySettings.countDocuments();
  if (setCount === 0) {
    await CompanySettings.create(defaultSettings);
    console.log('Seeded company settings');
  }

  console.log('Database seeding complete (dummy data not inserted — live-only mode)');
}

if (require.main === module) {
  seedDatabase().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
