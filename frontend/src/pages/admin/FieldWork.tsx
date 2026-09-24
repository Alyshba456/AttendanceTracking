import { useState } from 'react';
import { useData, FieldWorkEntry } from '../../context/DataContext';
import { api } from '../../utils/api';
import { Card, Badge, Table, TR, TD, Btn, SectionHeader, Modal, EmployeeCell, Avatar } from '../../components/ui';

export default function AdminFieldWork() {
  const { fieldWork, setFieldWork, employees, refreshAll } = useData();
  const [actionModal, setActionModal] = useState<{ type: 'approve' | 'reject'; id: number; name: string } | null>(null);
  const [viewEntry, setViewEntry] = useState<FieldWorkEntry | null>(null);
  const [savingAction, setSavingAction] = useState<{ id: number } | null>(null);

  const pending = fieldWork.filter(f => f.status === 'Pending').length;

  async function handleAction() {
    if (!actionModal || savingAction) return;
    const newStatus = actionModal.type === 'approve' ? 'Approved' : 'Rejected';
    setSavingAction({ id: actionModal.id });
    try {
      const res = await api.updateFieldWork({
        fwId: actionModal.id,
        status: newStatus,
      });
      if (!res.ok) {
        alert(`Failed to update field work: ${res.error || 'Please try again.'}`);
        return;
      }
      setFieldWork(prev => prev.map(e => e.id === actionModal!.id
        ? { ...e, status: newStatus }
        : e
      ));
      await refreshAll();
    } catch (e: any) {
      alert(`Failed to update field work: ${e?.message || 'Please try again.'}`);
      return;
    } finally {
      setSavingAction(null);
    }
    setActionModal(null);
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="p-5 pb-3 flex items-center justify-between flex-wrap gap-3">
          <div>
            <SectionHeader title={`Field Work Submissions (${fieldWork.length}) · ${pending} pending`} />
          </div>
        </div>
        <Table headers={['Employee', 'Date', 'Location', 'Start', 'End', 'Hours', 'Description', 'Status', 'Actions']}>
          {fieldWork.map(r => (
            <TR key={r.id}>
              <TD><EmployeeCell name={r.name} sub={`${r.empId} · ${employees.find(e => e.id === r.empId)?.dept ?? ''}`} /></TD>
              <TD>{r.date}</TD>
              <TD className="max-w-36">{r.location}</TD>
              <TD>{r.start}</TD>
              <TD>{r.end}</TD>
              <TD className="font-medium">{r.hours}</TD>
              <TD className="text-slate-500 text-xs max-w-36">{r.desc}</TD>
              <TD><Badge status={r.status} /></TD>
              <TD>
                <Btn size="sm" variant="ghost" onClick={() => setViewEntry(r)}>View</Btn>
              </TD>
            </TR>
          ))}
        </Table>
        <div className="p-4" />
      </Card>

      {/* View Details Modal */}
      {viewEntry && (
        <Modal title="Field Work Details" onClose={() => setViewEntry(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <Avatar name={viewEntry.name} size="lg" />
              <div>
                <p className="font-semibold text-slate-800">{viewEntry.name}</p>
                <p className="text-xs text-slate-500">
                  {employees.find(e => e.id === viewEntry.empId)?.dept ?? '—'} ·{' '}
                  {employees.find(e => e.id === viewEntry.empId)?.designation ?? '—'}
                </p>
              </div>
              <div className="ml-auto"><Badge status={viewEntry.status} /></div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'Date', value: viewEntry.date },
                { label: 'Total Hours', value: viewEntry.hours },
                { label: 'Start Time', value: viewEntry.start },
                { label: 'End Time', value: viewEntry.end },
              ].map(row => (
                <div key={row.label}>
                  <p className="text-xs text-slate-500 mb-0.5">{row.label}</p>
                  <p className="font-medium text-slate-800">{row.value}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="text-xs text-slate-500 mb-0.5">Location / Site</p>
                <p className="font-medium text-slate-800">{viewEntry.location}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500 mb-0.5">Purpose / Description</p>
                <p className="text-slate-700">{viewEntry.desc || '—'}</p>
              </div>
            </div>

            {viewEntry.status === 'Pending' && (
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <Btn variant="danger" onClick={() => { setActionModal({ type: 'reject', id: viewEntry.id, name: viewEntry.name }); setViewEntry(null); }} className="flex-1 justify-center">Reject</Btn>
                <Btn variant="success" onClick={() => { setActionModal({ type: 'approve', id: viewEntry.id, name: viewEntry.name }); setViewEntry(null); }} className="flex-1 justify-center">Approve</Btn>
              </div>
            )}
            {viewEntry.status !== 'Pending' && (
              <Btn variant="secondary" onClick={() => setViewEntry(null)} className="w-full justify-center">Close</Btn>
            )}
          </div>
        </Modal>
      )}

      {/* Approve / Reject confirmation */}
      {actionModal && (
        <Modal title={actionModal.type === 'approve' ? 'Approve Field Work' : 'Reject Field Work'} onClose={() => setActionModal(null)}>
          <p className="text-sm text-slate-600 mb-4">
            {actionModal.type === 'approve'
              ? `Approving will include this entry in ${actionModal.name}'s monthly total worked hours.`
              : `Rejecting will exclude this entry from ${actionModal.name}'s monthly total.`}
          </p>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => setActionModal(null)} className="flex-1 justify-center" disabled={!!savingAction}>Cancel</Btn>
            <Btn variant={actionModal.type === 'approve' ? 'success' : 'danger'} loading={savingAction?.id === actionModal.id} onClick={handleAction} className="flex-1 justify-center capitalize">
              {actionModal.type}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

