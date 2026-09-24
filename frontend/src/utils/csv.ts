function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number | boolean | undefined)[][]) {
  const head = headers.map(csvEscape).join(',');
  const body = rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
  const csv = '\ufeff' + head + '\r\n' + body; // BOM for Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseAttendanceDate(s: string): Date {
  return new Date(s + ', ' + new Date().getFullYear() + ' 00:00:00');
}

export function monthRangeDate(monthOffset = 0): { from: string; to: string } {
  const now = new Date();
  const m = now.getMonth() + monthOffset;
  const y = now.getFullYear();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { from: fmt(first), to: fmt(last) };
}

export function isDateInRange(dateStr: string, fromStr: string | null, toStr: string | null): boolean {
  if (!fromStr && !toStr) return true;
  const d = parseAttendanceDate(dateStr);
  if (fromStr) {
    const f = parseAttendanceDate(fromStr);
    if (d < f) return false;
  }
  if (toStr) {
    const t = parseAttendanceDate(toStr);
    t.setHours(23, 59, 59, 999);
    if (d > t) return false;
  }
  return true;
}

export function fromMinsCSV(m: number): string {
  if (m <= 0) return '0h';
  const h = Math.floor(m / 60), mi = m % 60;
  return mi ? `${h}h ${mi}m` : `${h}h`;
}

export function toMinsCSV(s: string): number {
  if (!s || s === '—') return 0;
  const m = String(s).match(/(\d+)h\s*(\d*)m?/);
  return m ? parseInt(m[1]) * 60 + (parseInt(m[2]) || 0) : 0;
}
