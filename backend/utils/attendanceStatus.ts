// Shared helpers for time parsing, status computation, and hour formatting.
// Works the same in: Node (Vercel serverless /api handlers), Vite SSR, and browser.
// IMPORTANT: All time + status logic in StaffSync must go through these helpers so that
// admin settings (workStartTime, workEndTime, lateBuffer, overtimeBuffer) are the single
// source of truth everywhere — Dashboard, Attendance tables, Reports PDFs, Employee portal,
// Backend attendance save, live clock badges.

export function parse24hToMinutes(hhmm: string): number | null {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

export function parse12hToMinutes(time12: string): number | null {
  if (!time12 || typeof time12 !== 'string') return null;
  const raw = time12.trim();
  if (!raw || raw === '—' || raw === '-') return null;
  const m = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|a\.m\.|p\.m\.)/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  const mer = (m[3] || '').toLowerCase().replace(/\./g, '');
  if (mer === 'pm' && h !== 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

export function parseAnyTimeToMinutes(t: unknown): number | null {
  if (!t) return null;
  const s = String(t);
  const p24 = parse24hToMinutes(s);
  if (p24 !== null) return p24;
  return parse12hToMinutes(s);
}

export type AttendanceStatus =
  | 'Present'
  | 'Late'
  | 'Overtime'
  | 'Leave'
  | 'Field Work'
  | 'Absent'
  | 'Pending';

export interface SettingsLike {
  workStartTime: string;
  workEndTime: string;
  lateBuffer: number;
  overtimeBuffer: number;
}

export function computeAttendanceStatus(
  settings: SettingsLike | null | undefined,
  clockInStr: unknown,
  clockOutStr: unknown,
  fallback?: AttendanceStatus | null
): AttendanceStatus {
  // Fallbacks (Leave / Field Work / Absent / Pending) take precedence if caller already
  // classified the day into a non-attendance category.
  if (fallback && fallback !== 'Present' && fallback !== 'Late' && fallback !== 'Overtime' && fallback !== 'Absent') {
    return fallback;
  }

  const ci = parseAnyTimeToMinutes(clockInStr);
  const co = parseAnyTimeToMinutes(clockOutStr);
  if (!ci && !co) {
    return 'Absent';
  }

  const defaultSettings: SettingsLike = {
    workStartTime: '09:00',
    workEndTime: '18:00',
    lateBuffer: 15,
    overtimeBuffer: 30,
  };
  const s: SettingsLike = { ...defaultSettings, ...(settings || {}) };
  const lateBuf = Number.isFinite(+s.lateBuffer) ? Math.max(0, +s.lateBuffer) : defaultSettings.lateBuffer;
  const otBuf = Number.isFinite(+s.overtimeBuffer) ? Math.max(0, +s.overtimeBuffer) : defaultSettings.overtimeBuffer;
  const startMin = parse24hToMinutes(s.workStartTime) ?? parse24hToMinutes(defaultSettings.workStartTime)!;
  const endMin = parse24hToMinutes(s.workEndTime) ?? parse24hToMinutes(defaultSettings.workEndTime)!;
  const lateCutoff = startMin + lateBuf; // inclusive: clock-in up to this minute = Present
  const otCutoff = endMin + otBuf;     // exclusive: clock-out strictly after this = Overtime

  let status: AttendanceStatus = 'Present';
  if (ci !== null) {
    status = ci <= lateCutoff ? 'Present' : 'Late';
  }
  if (co !== null && co > otCutoff) {
    status = 'Overtime';
  }
  return status;
}

export function formatHoursMinutes(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return '0h';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHoursMinutesFromHHMM(h12: unknown, m12: unknown): string {
  const a = parseAnyTimeToMinutes(h12);
  const b = parseAnyTimeToMinutes(m12);
  if (a === null || b === null) return '—';
  return formatHoursMinutes(Math.max(0, b - a));
}
