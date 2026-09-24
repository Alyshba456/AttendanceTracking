import { useMemo, useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useData, recentMonths, toMins, fromMins, departmentList, computeAttendanceStatus } from '../../context/DataContext';
import { Card, StatCard, Btn, Select, Modal, Table, TR, TD, EmployeeCell } from '../../components/ui';
import { downloadCSV } from '../../utils/csv';

type ReportKind = 'attendance' | 'leave' | 'fieldwork' | 'hours';

function parseMonthYear(monthLongYear: string): { year: number; monthIdx: number } {
  // monthLongYear = "January 2027" or "September 2026" — split by last space (in case names have spaces in other locales)
  const spaceIdx = (String(monthLongYear)).lastIndexOf(' ');
  if (spaceIdx < 0) {
    const d = new Date(String(monthLongYear) + ' 01');
    return { year: d.getFullYear(), monthIdx: d.getMonth() };
  }
  const monthPart = String(monthLongYear).slice(0, spaceIdx);
  const yearPart = String(monthLongYear).slice(spaceIdx + 1);
  const asDate = new Date(`${monthPart} 01, ${yearPart} 00:00:00`);
  if (isNaN(asDate.getTime())) {
    const now = new Date();
    return { year: now.getFullYear(), monthIdx: now.getMonth() };
  }
  return { year: asDate.getFullYear(), monthIdx: asDate.getMonth() };
}

function isInMonth(dateStr: string, monthLongYear: string): boolean {
  if (!dateStr) return false;
  const { year, monthIdx } = parseMonthYear(monthLongYear);
  // dateStr is in the locale format used by todayStr() everywhere in-app: e.g. "Sep 24, 2026"
  // Parse robustly by concatenating the TARGET year from the filter (NOT current year):
  const withoutYear = String(dateStr).replace(/,\s*\d{4}$/, ''); // strip existing year if present
  const d = new Date(`${withoutYear}, ${year} 00:00:00`);
  if (isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() === monthIdx;
}

function reportMonthRange(monthLongYear: string): { from: Date; to: Date; label: string } {
  const { year, monthIdx } = parseMonthYear(monthLongYear);
  const from = new Date(year, monthIdx, 1);
  const to = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
  const label = from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { from, to, label };
}

function hoursReportRows(employees: any[], attendance: any[], fieldWork: any[], monthFilter: string, empFilter: string, deptFilter: string) {
  const fwRowsByEmpDay = new Map<string, number>();
  for (const f of fieldWork) {
    if (f.status !== 'Approved') continue;
    if (monthFilter && !isInMonth(f.date, monthFilter)) continue;
    const key = `${f.empId}__${f.date}`;
    fwRowsByEmpDay.set(key, (fwRowsByEmpDay.get(key) ?? 0) + toMins(f.hours));
  }
  return employees
    .filter(e => empFilter === 'all' || e.id === empFilter)
    .filter(e => deptFilter === 'all' || e.dept === deptFilter)
    .map(e => {
      const att = attendance.filter(a => a.empId === e.id && (!monthFilter || isInMonth(a.date, monthFilter)));
      const office = att.reduce((s, r) => s + toMins(r.officeHours), 0);
      let field = 0;
      for (const d of att) {
        field += fwRowsByEmpDay.get(`${e.id}__${d.date}`) ?? 0;
      }
      const days = att.length;
      const avg = days > 0 ? office / days : 0;
      return {
        id: e.id, name: e.name, dept: e.dept, designation: e.designation,
        days,
        officeMin: office, fieldMin: field, totalMin: office + field, avgMin: avg,
      };
    });
}

export default function AdminReports() {
  const { employees, attendance, leaves, fieldWork, companySettings } = useData();
  const months = recentMonths(12);
  const [filterMonth, setFilterMonth] = useState(months[0]);
  const [filterEmp, setFilterEmp] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [month, setMonth] = useState(months[0]);
  const [emp, setEmp] = useState('all');
  const [dept, setDept] = useState('all');
  const [viewing, setViewing] = useState<ReportKind | null>(null);
  const [viewPdfUrl, setViewPdfUrl] = useState<string>('');
  const [viewPdfTitle, setViewPdfTitle] = useState<string>('');
  const [viewLoading, setViewLoading] = useState(false);
  const lastPdfUrlRef = useRef<string>('');

  // Revoke old blob URL whenever a new one is generated OR component unmounts — prevents memory leaks
  useEffect(() => {
    const current = lastPdfUrlRef.current;
    return () => {
      if (current) URL.revokeObjectURL(current);
    };
  }, []);

  // Whenever the View CTA opens a report (viewing changes to a kind), build the matching PDF
  // into an in-memory Blob, convert to blob URL, and feed to the iframe. Same jsPDF/autotable
  // rendering code path as the downloaded PDF — so View preview is pixel-identical.
  useEffect(() => {
    if (!viewing) {
      setViewPdfUrl('');
      setViewPdfTitle('');
      return;
    }
    let cancelled = false;
    setViewLoading(true);
    try {
      const { doc, title } = buildPdfDoc(viewing);
      const uint8 = doc.output('arraybuffer');
      const blob = new Blob([uint8], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      const prev = lastPdfUrlRef.current;
      if (prev) URL.revokeObjectURL(prev);
      lastPdfUrlRef.current = url;
      const { label } = reportMonthRange(filters.month);
      setViewPdfTitle(`${title} — ${label}`);
      setViewPdfUrl(url);
    } catch (err) {
      console.error(err);
      alert('Could not preview PDF.\n' + (err instanceof Error ? err.message : String(err)));
      setViewing(null);
    } finally {
      if (!cancelled) setViewLoading(false);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewing]);

  const depts = useMemo(() => departmentList(companySettings.customDepartments || [], employees), [companySettings.customDepartments, employees]);

  // Apply filter state only when Generate Report is clicked
  const filters = { month, emp, dept };

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => filters.emp === 'all' || e.id === filters.emp)
      .filter(e => filters.dept === 'all' || e.dept === filters.dept);
  }, [employees, filters.emp, filters.dept]);
  const empIds = useMemo(() => new Set(filteredEmployees.map(e => e.id)), [filteredEmployees]);

  const filteredAttendance = useMemo(() => {
    return attendance
      .filter(a => empIds.has(a.empId) && isInMonth(a.date, filters.month))
      .map(a => ({ ...a, status: computeAttendanceStatus(companySettings, a.clockIn, a.clockOut, a.status) }));
  }, [attendance, empIds, filters.month, companySettings]);

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => empIds.has(l.empId) && (
      isInMonth(l.start, filters.month) || isInMonth(l.end, filters.month) || isInMonth(l.reqDate ?? '', filters.month)
    ));
  }, [leaves, empIds, filters.month]);

  const filteredFieldWork = useMemo(() => {
    return fieldWork.filter(f => empIds.has(f.empId) && isInMonth(f.date, filters.month));
  }, [fieldWork, empIds, filters.month]);

  const activeCount = filteredEmployees.filter(e => e.status === 'Active').length;
  const presentCount = filteredAttendance.filter(a => a.status === 'Present' || a.status === 'Late' || a.status === 'Overtime').length;
  const avgAttPct = filteredAttendance.length > 0 ? `${Math.round((presentCount / filteredAttendance.length) * 100)}%` : '—';
  const totalMinsAtt = filteredAttendance.reduce((s, a) => s + toMins(a.officeHours), 0);
  const approvedFWmins = filteredFieldWork.filter(f => f.status === 'Approved').reduce((s, f) => s + toMins(f.hours), 0);
  const totalHrs = `${Math.floor((totalMinsAtt + approvedFWmins) / 60)}h`;
  const leaveDaysUsed = filteredLeaves.filter(l => l.status === 'Approved').reduce((s, l) => s + l.days, 0);

  const counts = {
    attendance: filteredAttendance.length,
    leave: filteredLeaves.length,
    fieldwork: filteredFieldWork.length,
    hours: hoursReportRows(filteredEmployees, filteredAttendance, filteredFieldWork, filters.month, 'all', 'all').length,
  };

  const generate = () => {
    setMonth(filterMonth);
    setEmp(filterEmp);
    setDept(filterDept);
    // Trigger overall PDF download after state flushes (so filters reflect latest dropdowns)
    setTimeout(() => generateOverallPdf(), 0);
  };

  // ---------- Generate Report CTA: Overall Employee Complete PDF (accumulates Attendance / Leave / Field Work / Hours per employee) ----------
  const generateOverallPdf = async () => {
    // Re-apply latest filter dropdowns snapshot — same logic as generate() so dropdowns always reflected
    const snapshotFilters = { month: filterMonth, emp: filterEmp, dept: filterDept };
    const empsF = employees
      .filter(e => snapshotFilters.emp === 'all' || e.id === snapshotFilters.emp)
      .filter(e => snapshotFilters.dept === 'all' || e.dept === snapshotFilters.dept);
    const empIdsF = new Set(empsF.map(e => e.id));
    const attF = attendance
      .filter(a => empIdsF.has(a.empId) && isInMonth(a.date, snapshotFilters.month))
      .map(a => ({ ...a, status: computeAttendanceStatus(companySettings, a.clockIn, a.clockOut, a.status) }));
    const lvF = leaves.filter(l => empIdsF.has(l.empId) && (
      isInMonth(l.start, snapshotFilters.month) || isInMonth(l.end, snapshotFilters.month) || isInMonth(l.reqDate ?? '', snapshotFilters.month)
    ));
    const fwF = fieldWork.filter(f => empIdsF.has(f.empId) && isInMonth(f.date, snapshotFilters.month));
    const hoursRowsF = hoursReportRows(empsF, attF, fwF, snapshotFilters.month, 'all', 'all');
    const { label } = reportMonthRange(snapshotFilters.month);

    if (empsF.length === 0) {
      alert('No employees match the selected Employee / Department filters.');
      return;
    }

    const filename = `staffsync_overall_${snapshotFilters.month.replace(/\s/g, '_')}${snapshotFilters.emp === 'all' ? '' : '_' + snapshotFilters.emp}.pdf`;

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginMM = 14;
      const printableW = pageW - marginMM * 2;

      const primary = '#1e3a8a';
      const secondary = '#475569';
      const light = '#f1f5f9';
      const accent = '#dbeafe';
      const border = '#e2e8f0';

      const baseStyles = {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 2,
        lineColor: border,
        lineWidth: 0.15,
        textColor: '#0f172a',
      };
      const headStyles: any = {
        fillColor: light,
        textColor: '#0f172a',
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left',
        lineColor: border,
        lineWidth: 0.15,
      };
      const alternateRowStyles = { fillColor: '#fafafa' };
      const didDrawPage = (d: any) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(secondary);
        doc.text(
          `Employee Complete Report — ${label}    |    Page ${d.pageNumber} of ${pageCount}`,
          pageW / 2,
          pageH - 6,
          { align: 'center' }
        );
      };

      function drawSectionTitle(startY: number, titleText: string, subtitle?: string): number {
        let y = startY;
        // Avoid splitting near the bottom of a page
        if (y + 12 > pageH - marginMM - 10) {
          doc.addPage();
          y = marginMM + 2;
        }
        doc.setDrawColor(accent);
        doc.setFillColor(accent);
        doc.roundedRect(marginMM, y, printableW, 7, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(primary);
        doc.text(titleText, marginMM + 3.5, y + 4.7);
        y += 9;
        if (subtitle) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(secondary);
          doc.text(subtitle, marginMM + 3.5, y);
          y += 5;
        }
        return y;
      }

      function drawEmployeeHeader(e: any, hrsRow: any | null, startY: number): number {
        let y = startY;
        // Employee header card
        const cardH = 25;
        doc.setDrawColor(border);
        doc.setFillColor('#f8fafc');
        doc.roundedRect(marginMM, y, printableW, cardH, 2.5, 2.5, 'FD');
        y += 5.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor('#0f172a');
        doc.text(`${e.name}`, marginMM + 5, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(secondary);
        const subLine = `${e.id}    ·    ${e.dept || '—'}    ·    ${e.designation || '—'}    ·    ${e.email || ''}    ·    Status: ${e.status}`;
        y += 4.8;
        doc.text(subLine, marginMM + 5, y);

        // KPI pills on the right: Days / Office / Field / Total / Leave
        const daysVal = hrsRow ? String(hrsRow.days) : '0';
        const offVal = hrsRow ? fromMins(hrsRow.officeMin) : '0h';
        const fldVal = hrsRow ? fromMins(hrsRow.fieldMin) : '0h';
        const totMin = hrsRow ? hrsRow.totalMin : 0;
        const totVal = hrsRow ? fromMins(hrsRow.totalMin) : '0h';
        const leaveDays = lvF.filter(l => l.empId === e.id && l.status === 'Approved').reduce((s, l) => s + l.days, 0);
        const presentDays = attF.filter(a => a.empId === e.id && (a.status === 'Present' || a.status === 'Late' || a.status === 'Overtime')).length;
        const fwDays = fwF.filter(f => f.empId === e.id && f.status === 'Approved').length;
        const pills: { label: string; val: string }[] = [
          { label: 'Days', val: daysVal },
          { label: 'Office', val: offVal },
          { label: 'Field', val: fldVal },
          { label: 'Total', val: totVal },
          { label: 'Leave', val: `${leaveDays}d` },
        ];
        // Second row mini pills
        const mini: { label: string; val: string }[] = [
          { label: 'Present Days', val: String(presentDays) },
          { label: 'Field Days', val: String(fwDays) },
          { label: 'Approved FW', val: String(fwF.filter(f => f.empId === e.id && f.status === 'Approved').length) },
          { label: 'Leave Requests', val: String(lvF.filter(l => l.empId === e.id).length) },
        ];

        // Draw pills along right edge of card (two rows of chips)
        const pillPadX = 4, pillPadY = 1.6, pillGap = 2.4;
        let xRight = marginMM + printableW - pillPadX;
        doc.setFontSize(9);
        const topRowY = startY + 5;
        // Compute widths and place right-to-left (top row)
        const pillTopDims = pills.map(p => {
          const txt = `${p.label}: ${p.val}`;
          const w = doc.getTextWidth(txt) + pillPadX * 2;
          return { ...p, txt, w };
        });
        for (let i = pillTopDims.length - 1; i >= 0; i--) {
          const p = pillTopDims[i];
          const x = xRight - p.w;
          doc.setFillColor('#ffffff');
          doc.setDrawColor(border);
          doc.roundedRect(x, topRowY - 3.8, p.w, 7, 1.8, 1.8, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(primary);
          doc.text(`${p.label}:`, x + pillPadX, topRowY);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor('#0f172a');
          doc.text(` ${p.val}`, x + pillPadX + doc.getTextWidth(`${p.label}:`), topRowY);
          xRight = x - pillGap;
        }
        const botRowY = startY + 15.2;
        xRight = marginMM + printableW - pillPadX;
        const pillBotDims = mini.map(p => {
          const txt = `${p.label}: ${p.val}`;
          const w = doc.getTextWidth(txt) + pillPadX * 2;
          return { ...p, txt, w };
        });
        for (let i = pillBotDims.length - 1; i >= 0; i--) {
          const p = pillBotDims[i];
          const x = xRight - p.w;
          doc.setFillColor('#ffffff');
          doc.setDrawColor(border);
          doc.roundedRect(x, botRowY - 3.6, p.w, 6.6, 1.8, 1.8, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(secondary);
          doc.text(`${p.label}:`, x + pillPadX, botRowY);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor('#0f172a');
          doc.text(` ${p.val}`, x + pillPadX + doc.getTextWidth(`${p.label}:`), botRowY);
          xRight = x - pillGap;
        }
        // Suppress unused var warnings
        void totMin;
        return startY + cardH + 4;
      }

      function smallTable(startY: number, title: string, subtitle: string, tHead: any[][], tBody: any[][], columns: any[]): number {
        const afterTitle = drawSectionTitle(startY, title, subtitle);
        autoTable(doc, {
          startY: afterTitle,
          margin: { top: marginMM, right: marginMM, bottom: marginMM + 8, left: marginMM },
          head: tHead,
          body: tBody,
          columns,
          styles: { ...baseStyles, overflow: 'linebreak' as any, valign: 'middle' as any, cellWidth: 'wrap' as any },
          headStyles,
          bodyStyles: {},
          alternateRowStyles,
          horizontalPageBreak: true,
          theme: 'grid',
          useCss: false,
          tableWidth: printableW,
          showHead: 'everyPage' as any,
          rowPageBreak: 'avoid' as any,
          pageBreak: 'auto' as any,
          didDrawPage,
        });
        // Cursor after table: lastAutoTable.finalY (autotable sets this on the doc)
        const finalY: number = (doc as any).lastAutoTable?.finalY ?? afterTitle + 10;
        return finalY + 4;
      }

      // ---------- Render per-employee sections ----------
      for (let idx = 0; idx < empsF.length; idx++) {
        const e = empsF[idx];
        if (idx === 0) {
          // First: overall report cover header (Page 1 only)
          let cursorY = marginMM;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(17);
          doc.setTextColor(primary);
          doc.text(`${companySettings.companyName || 'StaffSync'} — Employee Complete Report`, marginMM, cursorY);
          cursorY += 4.5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(secondary);
          doc.text(`Generated: ${new Date().toLocaleString()}`, marginMM, cursorY);
          cursorY += 7;

          // Title pill bar
          doc.setFillColor(light);
          doc.roundedRect(marginMM, cursorY, printableW, 10, 2, 2, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(primary);
          doc.text(`Overall Employee Report — ${label}`, marginMM + 4, cursorY + 6.6);
          cursorY += 14;

          // Global meta / KPIs block
          const metaLines = [
            `Period: ${label}`,
            `Employee Filter: ${snapshotFilters.emp === 'all' ? 'All Employees' : (empsF[0]?.name || snapshotFilters.emp)}  (${empsF.length} employee${empsF.length === 1 ? '' : 's'} in scope)`,
            `Department Filter: ${snapshotFilters.dept === 'all' ? 'All Departments' : snapshotFilters.dept}`,
            `Aggregate totals: ${attF.length} attendance entries · ${lvF.length} leave requests · ${fwF.length} field work entries`,
          ];
          const metaFontSize = 10;
          doc.setFontSize(metaFontSize);
          const chipLineH = 5.8;
          const metaH = 5 + metaLines.length * chipLineH;
          doc.setDrawColor(border);
          doc.setFillColor('#f8fafc');
          doc.roundedRect(marginMM, cursorY, printableW, metaH, 2.5, 2.5, 'FD');
          let my = cursorY + 5.5;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(secondary);
          for (const line of metaLines) {
            doc.text(line, marginMM + 4, my);
            my += chipLineH;
          }
          cursorY = cursorY + metaH + 6;

          // Start first employee header after the cover header
          const hrsRow = hoursRowsF.find(h => h.id === e.id) || null;
          let empCursor = drawEmployeeHeader(e, hrsRow, cursorY);

          // ---- Attendance ----
          const empAtt = attF.filter(a => a.empId === e.id);
          const attHead = [['Date', 'Clock In', 'Clock Out', 'Office Hrs', 'Field Hrs', 'Total Hrs', 'Status']];
          let attBody: any[][] = [];
          if (empAtt.length === 0) {
            attBody = [[{ content: 'No attendance records for this employee in the selected period.', colSpan: 7, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 9 } }]];
          } else {
            for (const a of empAtt) {
              const fwSameDay = fwF.find(f => f.empId === a.empId && f.date === a.date && f.status === 'Approved');
              const fwH = fwSameDay?.hours ?? '';
              const tot = toMins(a.officeHours ?? '') + toMins(fwH);
              attBody.push([
                a.date, a.clockIn ?? '', a.clockOut ?? '',
                a.officeHours ?? '', fwH,
                tot > 0 ? fromMins(tot) : '', a.status,
              ]);
            }
          }
          empCursor = smallTable(empCursor, `Attendance (${empAtt.length})`, 'Daily clock-in / clock-out records with combined office + field hours',
            attHead, attBody,
            [
              { header: 'Date', dataKey: 'c0', width: 30 },
              { header: 'Clock In', dataKey: 'c1', width: 22 },
              { header: 'Clock Out', dataKey: 'c2', width: 22 },
              { header: 'Office Hrs', dataKey: 'c3', width: 22 },
              { header: 'Field Hrs', dataKey: 'c4', width: 22 },
              { header: 'Total Hrs', dataKey: 'c5', width: 24 },
              { header: 'Status', dataKey: 'c6', width: 22 },
            ]);

          // ---- Leaves ----
          const empLv = lvF.filter(l => l.empId === e.id);
          const lvHead = [['Type', 'Start', 'End', 'Days', 'Reason', 'Status']];
          let lvBody: any[][] = [];
          if (empLv.length === 0) {
            lvBody = [[{ content: 'No leave requests for this employee in the selected period.', colSpan: 6, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 9 } }]];
          } else {
            for (const l of empLv) {
              lvBody.push([l.type, l.start, l.end, String(l.days), l.reason ?? '', l.status]);
            }
          }
          empCursor = smallTable(empCursor, `Leaves (${empLv.length})`, 'Leave requests and their current approval status',
            lvHead, lvBody,
            [
              { header: 'Type', dataKey: 'c0', width: 30 },
              { header: 'Start', dataKey: 'c1', width: 28 },
              { header: 'End', dataKey: 'c2', width: 28 },
              { header: 'Days', dataKey: 'c3', width: 16 },
              { header: 'Reason', dataKey: 'c4' },
              { header: 'Status', dataKey: 'c5', width: 24 },
            ]);

          // ---- Field Work ----
          const empFw = fwF.filter(f => f.empId === e.id);
          const fwHead = [['Date', 'Location', 'Start', 'End', 'Hours', 'Description', 'Status']];
          let fwBody: any[][] = [];
          if (empFw.length === 0) {
            fwBody = [[{ content: 'No field work entries for this employee in the selected period.', colSpan: 7, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 9 } }]];
          } else {
            for (const f of empFw) {
              fwBody.push([f.date, f.location, f.start, f.end, String(f.hours), f.desc ?? '', f.status]);
            }
          }
          empCursor = smallTable(empCursor, `Field Work (${empFw.length})`, 'On-site visits and logged field hours',
            fwHead, fwBody,
            [
              { header: 'Date', dataKey: 'c0', width: 28 },
              { header: 'Location', dataKey: 'c1', width: 52 },
              { header: 'Start', dataKey: 'c2', width: 18 },
              { header: 'End', dataKey: 'c3', width: 18 },
              { header: 'Hours', dataKey: 'c4', width: 16 },
              { header: 'Description', dataKey: 'c5' },
              { header: 'Status', dataKey: 'c6', width: 22 },
            ]);

          // ---- Hours summary ----
          const hrHead = [['Days Worked', 'Office Hrs', 'Field Hrs', 'Total Hrs', 'Avg Office / Day']];
          let hrBody: any[][] = [];
          if (!hrsRow) {
            hrBody = [[{ content: 'No hours summary data available for this employee.', colSpan: 5, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 9 } }]];
          } else {
            hrBody = [[
              String(hrsRow.days),
              fromMins(hrsRow.officeMin),
              fromMins(hrsRow.fieldMin),
              fromMins(hrsRow.totalMin),
              fromMins(hrsRow.avgMin),
            ]];
          }
          smallTable(empCursor, 'Hours Summary — Accumulated Totals', 'Aggregate monthly totals combining office + field work',
            hrHead, hrBody,
            [
              { header: 'Days Worked', dataKey: 'c0', width: 30 },
              { header: 'Office Hrs', dataKey: 'c1', width: 30 },
              { header: 'Field Hrs', dataKey: 'c2', width: 30 },
              { header: 'Total Hrs', dataKey: 'c3', width: 30 },
              { header: 'Avg Office / Day', dataKey: 'c4', width: 30 },
            ]);
        } else {
          // New employee — new page
          doc.addPage();
          const hrsRow = hoursRowsF.find(h => h.id === e.id) || null;
          let empCursor = drawEmployeeHeader(e, hrsRow, marginMM + 2);

          // Same 4 sections as first employee
          const empAtt = attF.filter(a => a.empId === e.id);
          const attHead = [['Date', 'Clock In', 'Clock Out', 'Office Hrs', 'Field Hrs', 'Total Hrs', 'Status']];
          let attBody: any[][] = [];
          if (empAtt.length === 0) {
            attBody = [[{ content: 'No attendance records for this employee in the selected period.', colSpan: 7, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 9 } }]];
          } else {
            for (const a of empAtt) {
              const fwSameDay = fwF.find(f => f.empId === a.empId && f.date === a.date && f.status === 'Approved');
              const fwH = fwSameDay?.hours ?? '';
              const tot = toMins(a.officeHours ?? '') + toMins(fwH);
              attBody.push([a.date, a.clockIn ?? '', a.clockOut ?? '', a.officeHours ?? '', fwH, tot > 0 ? fromMins(tot) : '', a.status]);
            }
          }
          empCursor = smallTable(empCursor, `Attendance (${empAtt.length})`, 'Daily clock-in / clock-out records with combined office + field hours',
            attHead, attBody,
            [
              { header: 'Date', dataKey: 'c0', width: 30 },
              { header: 'Clock In', dataKey: 'c1', width: 22 },
              { header: 'Clock Out', dataKey: 'c2', width: 22 },
              { header: 'Office Hrs', dataKey: 'c3', width: 22 },
              { header: 'Field Hrs', dataKey: 'c4', width: 22 },
              { header: 'Total Hrs', dataKey: 'c5', width: 24 },
              { header: 'Status', dataKey: 'c6', width: 22 },
            ]);

          const empLv = lvF.filter(l => l.empId === e.id);
          const lvHead = [['Type', 'Start', 'End', 'Days', 'Reason', 'Status']];
          let lvBody: any[][] = [];
          if (empLv.length === 0) {
            lvBody = [[{ content: 'No leave requests for this employee in the selected period.', colSpan: 6, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 9 } }]];
          } else {
            for (const l of empLv) {
              lvBody.push([l.type, l.start, l.end, String(l.days), l.reason ?? '', l.status]);
            }
          }
          empCursor = smallTable(empCursor, `Leaves (${empLv.length})`, 'Leave requests and their current approval status',
            lvHead, lvBody,
            [
              { header: 'Type', dataKey: 'c0', width: 30 },
              { header: 'Start', dataKey: 'c1', width: 28 },
              { header: 'End', dataKey: 'c2', width: 28 },
              { header: 'Days', dataKey: 'c3', width: 16 },
              { header: 'Reason', dataKey: 'c4' },
              { header: 'Status', dataKey: 'c5', width: 24 },
            ]);

          const empFw = fwF.filter(f => f.empId === e.id);
          const fwHead = [['Date', 'Location', 'Start', 'End', 'Hours', 'Description', 'Status']];
          let fwBody: any[][] = [];
          if (empFw.length === 0) {
            fwBody = [[{ content: 'No field work entries for this employee in the selected period.', colSpan: 7, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 9 } }]];
          } else {
            for (const f of empFw) {
              fwBody.push([f.date, f.location, f.start, f.end, String(f.hours), f.desc ?? '', f.status]);
            }
          }
          empCursor = smallTable(empCursor, `Field Work (${empFw.length})`, 'On-site visits and logged field hours',
            fwHead, fwBody,
            [
              { header: 'Date', dataKey: 'c0', width: 28 },
              { header: 'Location', dataKey: 'c1', width: 52 },
              { header: 'Start', dataKey: 'c2', width: 18 },
              { header: 'End', dataKey: 'c3', width: 18 },
              { header: 'Hours', dataKey: 'c4', width: 16 },
              { header: 'Description', dataKey: 'c5' },
              { header: 'Status', dataKey: 'c6', width: 22 },
            ]);

          const hrHead = [['Days Worked', 'Office Hrs', 'Field Hrs', 'Total Hrs', 'Avg Office / Day']];
          let hrBody: any[][] = [];
          if (!hrsRow) {
            hrBody = [[{ content: 'No hours summary data available for this employee.', colSpan: 5, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 9 } }]];
          } else {
            hrBody = [[
              String(hrsRow.days),
              fromMins(hrsRow.officeMin),
              fromMins(hrsRow.fieldMin),
              fromMins(hrsRow.totalMin),
              fromMins(hrsRow.avgMin),
            ]];
          }
          smallTable(empCursor, 'Hours Summary — Accumulated Totals', 'Aggregate monthly totals combining office + field work',
            hrHead, hrBody,
            [
              { header: 'Days Worked', dataKey: 'c0', width: 30 },
              { header: 'Office Hrs', dataKey: 'c1', width: 30 },
              { header: 'Field Hrs', dataKey: 'c2', width: 30 },
              { header: 'Total Hrs', dataKey: 'c3', width: 30 },
              { header: 'Avg Office / Day', dataKey: 'c4', width: 30 },
            ]);
        }
      }

      doc.save(filename);
    } catch (err) {
      console.error(err);
      alert('Could not generate PDF.\n' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // CSV exports
  const exportAttCsv = () => {
    downloadCSV(`staffsync_attendance_${filters.month.replace(/\s/g, '_')}.csv`,
      ['Employee', 'Employee ID', 'Department', 'Date', 'Clock In', 'Clock Out', 'Office Hours', 'Field Hours', 'Total Hours', 'Status'],
      filteredAttendance.map(a => {
        const e = employees.find(x => x.id === a.empId);
        const fw = fieldWork.find(f => f.empId === a.empId && f.date === a.date && f.status === 'Approved');
        const fwH = fw?.hours ?? '';
        const tot = toMins(a.officeHours ?? '') + toMins(fwH);
        return [a.name, a.empId ?? (e?.id ?? ''), e?.dept ?? '', a.date, a.clockIn ?? '', a.clockOut ?? '', a.officeHours ?? '', fwH, tot > 0 ? fromMins(tot) : '', a.status];
      })
    );
  };

  const exportLeaveCsv = () => {
    downloadCSV(`staffsync_leaves_${filters.month.replace(/\s/g, '_')}.csv`,
      ['Employee', 'Employee ID', 'Department', 'Type', 'Start', 'End', 'Days', 'Reason', 'Request Date', 'Status'],
      filteredLeaves.map(l => {
        const e = employees.find(x => x.id === l.empId);
        return [l.name, l.empId ?? (e?.id ?? ''), e?.dept ?? '', l.type, l.start, l.end, l.days, l.reason ?? '', l.reqDate ?? '', l.status];
      })
    );
  };

  const exportFwCsv = () => {
    downloadCSV(`staffsync_fieldwork_${filters.month.replace(/\s/g, '_')}.csv`,
      ['Employee', 'Employee ID', 'Department', 'Date', 'Location', 'Start', 'End', 'Hours', 'Description', 'Status'],
      filteredFieldWork.map(f => {
        const e = employees.find(x => x.id === f.empId);
        return [f.name, f.empId ?? (e?.id ?? ''), e?.dept ?? '', f.date, f.location, f.start, f.end, f.hours, f.desc ?? '', f.status];
      })
    );
  };

  const exportHoursCsv = () => {
    const rows = hoursReportRows(filteredEmployees, filteredAttendance, filteredFieldWork, filters.month, 'all', 'all');
    downloadCSV(`staffsync_hours_${filters.month.replace(/\s/g, '_')}.csv`,
      ['Employee ID', 'Employee', 'Department', 'Designation', 'Days Worked', 'Office Hours', 'Field Hours', 'Total Hours', 'Avg Office Hrs/Day'],
      rows.map(r => [r.id, r.name, r.dept, r.designation, r.days, fromMins(r.officeMin), fromMins(r.fieldMin), fromMins(r.totalMin), fromMins(r.avgMin)])
    );
  };

  // ---------- Shared PDF builder: returns { doc, filename, title } without calling .save() ----------
  //                              → used by both "Download PDF" CTAs and the "View" PDF preview
  const buildPdfDoc = (kind: ReportKind): { doc: jsPDF; filename: string; title: string } => {
    const { label } = reportMonthRange(filters.month);
    const title = {
      attendance: 'Attendance Report',
      leave: 'Leave Report',
      fieldwork: 'Field Work Report',
      hours: 'Monthly Hours Report',
    }[kind];

    const metaLines: string[] = [
      `Period: ${label}`,
      `Employees: ${filters.emp === 'all' ? 'All' : (employees.find(x => x.id === filters.emp)?.name || filters.emp)}`,
      `Department: ${filters.dept === 'all' ? 'All' : filters.dept}`,
      `Active employees in period: ${activeCount}`,
      `Generated: ${new Date().toLocaleString()}`,
    ];

    const filename = `staffsync_${kind}_${filters.month.replace(/\s/g, '_')}.pdf`;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginMM = 14;
    const printableW = pageW - marginMM * 2;

    const primary = '#1e3a8a';
    const secondary = '#475569';
    const light = '#f1f5f9';
    const border = '#e2e8f0';

    let cursorY = marginMM;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(primary);
    doc.text(`${companySettings.companyName || 'StaffSync'} — Reports`, marginMM, cursorY);
    cursorY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(secondary);
    doc.text(new Date().toLocaleString(), marginMM, cursorY);
    cursorY += 7;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(marginMM, cursorY, printableW, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(primary);
    doc.text(`${title} — ${label}`, marginMM + 4, cursorY + 6.6);
    cursorY += 14;

    const metaX = marginMM;
    const metaW = printableW;
    const metaFontSize = 10;
    doc.setFontSize(metaFontSize);
    const chipLineH = 5.8;
    const metaH = 5 + metaLines.length * chipLineH;
    doc.setDrawColor(border);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(metaX, cursorY, metaW, metaH, 2.5, 2.5, 'FD');
    let my = cursorY + 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(secondary);
    for (const line of metaLines) {
      doc.text(line, metaX + 4, my);
      my += chipLineH;
    }
    cursorY = cursorY + metaH + 6;

    const baseStyles = {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: 2.2,
      lineColor: border,
      lineWidth: 0.15,
      textColor: '#0f172a',
    };
    const headStyles: any = {
      fillColor: light,
      textColor: '#0f172a',
      fontStyle: 'bold',
      fontSize: 9.5,
      halign: 'left',
      lineColor: border,
      lineWidth: 0.15,
    };
    const alternateRowStyles = { fillColor: '#fafafa' };
    const didDrawPage = (d: any) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(secondary);
      doc.text(
        `${title} — ${label}    |    Page ${d.pageNumber} of ${pageCount}`,
        pageW / 2,
        pageH - 6,
        { align: 'center' }
      );
    };

    let tHead: any[][] = [];
    let tBody: any[][] = [];
    let columns: any[] = [];

    if (kind === 'attendance') {
      tHead = [['Employee', 'Date', 'Clock In', 'Clock Out', 'Office Hrs', 'Field Hrs', 'Total Hrs', 'Status']];
      if (filteredAttendance.length === 0) {
        tBody = [[{ content: 'No attendance records for the selected period.', colSpan: 8, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 10 } }]];
      } else {
        for (const a of filteredAttendance) {
          const fw = fieldWork.find(f => f.empId === a.empId && f.date === a.date && f.status === 'Approved');
          const fwH = fw?.hours ?? '';
          const tot = toMins(a.officeHours ?? '') + toMins(fwH);
          tBody.push([
            a.name, a.date, a.clockIn ?? '', a.clockOut ?? '', a.officeHours ?? '', fwH,
            tot > 0 ? fromMins(tot) : '', a.status,
          ]);
        }
      }
      columns = [
        { header: 'Employee', dataKey: 'c0', width: 60 },
        { header: 'Date', dataKey: 'c1', width: 30 },
        { header: 'Clock In', dataKey: 'c2', width: 22 },
        { header: 'Clock Out', dataKey: 'c3', width: 22 },
        { header: 'Office Hrs', dataKey: 'c4', width: 22 },
        { header: 'Field Hrs', dataKey: 'c5', width: 22 },
        { header: 'Total Hrs', dataKey: 'c6', width: 24 },
        { header: 'Status', dataKey: 'c7', width: 22 },
      ];
    } else if (kind === 'leave') {
      tHead = [['Employee', 'Leave Type', 'Start', 'End', 'Days', 'Reason', 'Status']];
      if (filteredLeaves.length === 0) {
        tBody = [[{ content: 'No leave requests for the selected period.', colSpan: 7, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 10 } }]];
      } else {
        for (const l of filteredLeaves) {
          tBody.push([l.name, l.type, l.start, l.end, String(l.days), l.reason ?? '', l.status]);
        }
      }
      columns = [
        { header: 'Employee', dataKey: 'c0', width: 50 },
        { header: 'Leave Type', dataKey: 'c1', width: 30 },
        { header: 'Start', dataKey: 'c2', width: 28 },
        { header: 'End', dataKey: 'c3', width: 28 },
        { header: 'Days', dataKey: 'c4', width: 16 },
        { header: 'Reason', dataKey: 'c5' },
        { header: 'Status', dataKey: 'c6', width: 24 },
      ];
    } else if (kind === 'fieldwork') {
      tHead = [['Employee', 'Date', 'Location', 'Start', 'End', 'Hours', 'Description', 'Status']];
      if (filteredFieldWork.length === 0) {
        tBody = [[{ content: 'No field work entries for the selected period.', colSpan: 8, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 10 } }]];
      } else {
        for (const f of filteredFieldWork) {
          tBody.push([f.name, f.date, f.location, f.start, f.end, String(f.hours), f.desc ?? '', f.status]);
        }
      }
      columns = [
        { header: 'Employee', dataKey: 'c0', width: 48 },
        { header: 'Date', dataKey: 'c1', width: 28 },
        { header: 'Location', dataKey: 'c2', width: 48 },
        { header: 'Start', dataKey: 'c3', width: 18 },
        { header: 'End', dataKey: 'c4', width: 18 },
        { header: 'Hours', dataKey: 'c5', width: 16 },
        { header: 'Description', dataKey: 'c6' },
        { header: 'Status', dataKey: 'c7', width: 22 },
      ];
    } else {
      const rows = hoursReportRows(filteredEmployees, filteredAttendance, filteredFieldWork, filters.month, 'all', 'all');
      tHead = [['Employee', 'Dept', 'Days Worked', 'Office Hrs', 'Field Hrs', 'Total Hrs', 'Avg Office/Day']];
      if (rows.length === 0) {
        tBody = [[{ content: 'No employee data for the selected period.', colSpan: 7, styles: { halign: 'center', textColor: '#64748b', fillColor: '#ffffff', fontStyle: 'italic', fontSize: 10 } }]];
      } else {
        for (const r of rows) {
          tBody.push([
            r.name, r.dept, String(r.days),
            fromMins(r.officeMin), fromMins(r.fieldMin), fromMins(r.totalMin), fromMins(r.avgMin),
          ]);
        }
      }
      columns = [
        { header: 'Employee', dataKey: 'c0', width: 60 },
        { header: 'Dept', dataKey: 'c1', width: 40 },
        { header: 'Days Worked', dataKey: 'c2', width: 24 },
        { header: 'Office Hrs', dataKey: 'c3', width: 28 },
        { header: 'Field Hrs', dataKey: 'c4', width: 28 },
        { header: 'Total Hrs', dataKey: 'c5', width: 28 },
        { header: 'Avg Office/Day', dataKey: 'c6', width: 30 },
      ];
    }

    autoTable(doc, {
      startY: cursorY,
      margin: { top: marginMM, right: marginMM, bottom: marginMM + 8, left: marginMM },
      head: tHead, body: tBody, columns,
      styles: { ...baseStyles, overflow: 'linebreak' as any, valign: 'middle' as any, cellWidth: 'wrap' as any },
      headStyles,
      bodyStyles: {},
      alternateRowStyles,
      horizontalPageBreak: true,
      theme: 'grid',
      useCss: false,
      tableWidth: printableW,
      showHead: 'everyPage' as any,
      rowPageBreak: 'avoid' as any,
      pageBreak: 'auto' as any,
      didDrawPage,
    });

    return { doc, filename, title };
  };

  // PDF download CTA (reuses shared builder, then triggers browser save)
  const savePdf = async (kind: ReportKind) => {
    try {
      const { doc, filename } = buildPdfDoc(kind);
      doc.save(filename);
    } catch (err) {
      console.error(err);
      alert('Could not generate PDF.\n' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48">
            <Select label="Month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
              {months.map(m => <option key={m}>{m}</option>)}
            </Select>
          </div>
          <div className="w-48">
            <Select label="Employee" value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
              <option value="all">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </div>
          <div className="w-48">
            <Select label="Department" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="all">All Departments</option>
              {depts.map(d => <option key={d}>{d}</option>)}
            </Select>
          </div>
          <Btn onClick={generate} className="h-[42px]">Generate Report</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Employees" value={activeCount} color="blue" />
        <StatCard label="Avg Attendance" value={avgAttPct} sub="Based on records" color="green" />
        <StatCard label="Total Hrs Worked" value={totalHrs} color="slate" />
        <StatCard label="Leave Days Used" value={leaveDaysUsed} color="purple" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {([
          { kind: 'attendance' as ReportKind, title: 'Attendance Report', desc: 'Daily clock-in/out records for all employees', icon: '✓', count: `${counts.attendance} records` },
          { kind: 'leave' as ReportKind, title: 'Leave Report', desc: 'All leave requests, approvals and balances', icon: '◈', count: `${counts.leave} requests` },
          { kind: 'fieldwork' as ReportKind, title: 'Field Work Report', desc: 'All submitted and approved field work hours', icon: '◎', count: `${counts.fieldwork} submissions` },
          { kind: 'hours' as ReportKind, title: 'Monthly Hours Report', desc: 'Office + Field = Total worked hours per employee', icon: '▤', count: `${counts.hours} employees` },
        ]).map(r => (
          <Card key={r.kind} className="p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 text-xl">{r.icon}</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800 text-base">{r.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
              <p className="text-xs text-blue-600 font-semibold mt-1">{r.count}</p>
              <div className="flex gap-2 mt-3">
                <Btn size="sm" variant="secondary" onClick={() => setViewing(r.kind)}>View</Btn>
                <Btn size="sm" variant="ghost" onClick={() => {
                  if (r.kind === 'attendance') exportAttCsv();
                  else if (r.kind === 'leave') exportLeaveCsv();
                  else if (r.kind === 'fieldwork') exportFwCsv();
                  else exportHoursCsv();
                }}>CSV</Btn>
                <Btn size="sm" variant="ghost" onClick={() => savePdf(r.kind)}>PDF</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {viewing !== null && (
        <Modal
          title={viewPdfTitle || 'Report Preview'}
          onClose={() => setViewing(null)}
          maxWidthClass="!max-w-[95vw]"
        >
          {viewLoading || !viewPdfUrl ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              <span className="inline-block w-4 h-4 mr-2 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              Generating preview…
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500">
                  Read-only preview — pixel-identical to the downloaded PDF. Use the separate PDF CTA to download.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100" style={{ height: 'calc(min(80vh, 820px))' }}>
                <iframe
                  title={viewPdfTitle || 'Report PDF Preview'}
                  src={`${viewPdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                  className="w-full h-full bg-white"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
