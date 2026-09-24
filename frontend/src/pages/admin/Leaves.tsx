import { useState } from 'react';
import { useData, Leave } from '../../context/DataContext';
import { api } from '../../utils/api';
import { Card, Badge, Table, TR, TD, Btn, SectionHeader, Modal, EmployeeCell, Avatar } from '../../components/ui';

type Tab = 'pending' | 'approved' | 'rejected';

export default function AdminLeaves() {
  const { leaves, setLeaves, employees, refreshAll } = useData();
  const [tab, setTab] = useState<Tab>('pending');
  const [viewEntry, setViewEntry] = useState<Leave | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: 'approve' | 'reject'; id: number; name: string } | null>(null);
  const [savingAction, setSavingAction] = useState<{ id: number } | null>(null);

  const filtered = leaves.filter(l => l.status.toLowerCase() === tab);

  async function handleAction() {
    if (!confirmModal || savingAction) return;
    const newStatus = confirmModal.type === 'approve' ? 'Approved' : 'Rejected';
    setSavingAction({ id: confirmModal.id });
    try {
      const res = await api.updateLeave({
        leaveId: confirmModal.id,
        status: newStatus,
        reconsidered: confirmModal.type === 'reject' ? true : undefined,
      });
      if (!res.ok) {
        alert(`Failed to update leave: ${res.error || 'Please try again.'}`);
        return;
      }
      setLeaves(prev => prev.map(l => l.id === confirmModal!.id
        ? { ...l, status: newStatus, reconsidered: l.reconsidered || confirmModal!.type === 'reject' }
        : l
      ));
      await refreshAll();
    } catch (e: any) {
      alert(`Failed to update leave: ${e?.message || 'Please try again.'}`);
      return;
    } finally {
      setSavingAction(null);
    }
    setConfirmModal(null);
    setViewEntry(null);
  }

  function openConfirm(type: 'approve' | 'reject', entry: Leave) {
    setViewEntry(null);
    setConfirmModal({ type, id: entry.id, name: entry.name });
  }

  async function handleReconsider(entry: Leave) {
    if (savingAction) return;
    setSavingAction({ id: entry.id });
    try {
      const res = await api.updateLeave({
        leaveId: entry.id,
        status: 'Pending',
        reconsidered: true,
      });
      if (!res.ok) {
        alert(`Failed to reconsider leave: ${res.error || 'Please try again.'}`);
        return;
      }
      setLeaves(prev => prev.map(l => l.id === entry.id
        ? { ...l, status: 'Pending', reconsidered: true }
        : l
      ));
      await refreshAll();
    } catch (e: any) {
      alert(`Failed to reconsider leave: ${e?.message || 'Please try again.'}`);
      return;
    } finally {
      setSavingAction(null);
    }
    setViewEntry(null);
    setTab('pending');
  }

  const emp = viewEntry ? employees.find(e => e.id === viewEntry.empId) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          {(['pending', 'approved', 'rejected'] as Tab[]).map(t => {
            const count = leaves.filter(l => l.status.toLowerCase() === t).length;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                  tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t} <span className="ml-1 text-xs opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <Card>
        <div className="p-5 pb-3">
          <SectionHeader title={`${tab.charAt(0).toUpperCase() + tab.slice(1)} Leave Requests`} />
        </div>
        <Table headers={['Employee', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Request Date', 'Status', 'Actions']}>
          {filtered.map(r => (
            <TR key={r.id}>
              <TD><EmployeeCell name={r.name} sub={`${r.empId} · ${employees.find(e => e.id === r.empId)?.dept ?? ''}`} /></TD>
              <TD>{r.type}</TD>
              <TD>{r.start}</TD>
              <TD>{r.end}</TD>
              <TD>{r.days}</TD>
              <TD className="text-slate-500 text-xs max-w-36">{r.reason}</TD>
              <TD>{r.reqDate}</TD>
              <TD><Badge status={r.status} /></TD>
              <TD>
                <Btn size="sm" variant="ghost" onClick={() => setViewEntry(r)}>View</Btn>
              </TD>
            </TR>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={9} className="text-center text-sm text-slate-400 py-8">No {tab} requests</td></tr>
          )}
        </Table>
        <div className="p-4" />
      </Card>

      {/* View Details Modal */}
      {viewEntry && (
        <Modal title="Leave Request Details" onClose={() => setViewEntry(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <Avatar name={viewEntry.name} size="lg" />
              <div>
                <p className="font-semibold text-slate-800">{viewEntry.name}</p>
                <p className="text-xs text-slate-500">
                  {emp?.dept ?? '—'} · {emp?.designation ?? '—'}
                </p>
              </div>
              <div className="ml-auto"><Badge status={viewEntry.status} /></div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'Leave Type', value: viewEntry.type },
                { label: 'Total Days', value: `${viewEntry.days} day${viewEntry.days !== 1 ? 's' : ''}` },
                { label: 'Start Date', value: viewEntry.start },
                { label: 'End Date', value: viewEntry.end },
                { label: 'Request Date', value: viewEntry.reqDate },
              ].map(row => (
                <div key={row.label}>
                  <p className="text-xs text-slate-500 mb-0.5">{row.label}</p>
                  <p className="font-medium text-slate-800">{row.value}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="text-xs text-slate-500 mb-0.5">Reason</p>
                <p className="text-slate-700">{viewEntry.reason || '—'}</p>
              </div>
            </div>

            {viewEntry.status === 'Pending' && (
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <Btn variant="danger" onClick={() => openConfirm('reject', viewEntry)} className="flex-1 justify-center">Reject</Btn>
                <Btn variant="success" onClick={() => openConfirm('approve', viewEntry)} className="flex-1 justify-center">Approve</Btn>
              </div>
            )}
            {viewEntry.status === 'Rejected' && !viewEntry.reconsidered && (
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <Btn variant="secondary" onClick={() => setViewEntry(null)} className="flex-1 justify-center">Close</Btn>
                <Btn variant="primary" loading={savingAction?.id === viewEntry.id} onClick={() => handleReconsider(viewEntry)} className="flex-1 justify-center">Reconsider</Btn>
              </div>
            )}
            {(viewEntry.status === 'Approved' || (viewEntry.status === 'Rejected' && viewEntry.reconsidered)) && (
              <Btn variant="secondary" onClick={() => setViewEntry(null)} className="w-full justify-center">Close</Btn>
            )}
          </div>
        </Modal>
      )}

      {/* Approve / Reject confirmation */}
      {confirmModal && (
        <Modal title={confirmModal.type === 'approve' ? 'Approve Leave' : 'Reject Leave'} onClose={() => setConfirmModal(null)}>
          <p className="text-sm text-slate-600 mb-4">
            Confirm <strong>{confirmModal.type}</strong> for <strong>{confirmModal.name}</strong>'s leave request?
          </p>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => setConfirmModal(null)} className="flex-1 justify-center" disabled={!!savingAction}>Cancel</Btn>
            <Btn variant={confirmModal.type === 'approve' ? 'success' : 'danger'} loading={savingAction?.id === confirmModal.id} onClick={handleAction} className="flex-1 justify-center capitalize">
              {confirmModal.type}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

