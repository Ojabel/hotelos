import type { ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

export function ConfirmDialog({ open, title, children, confirmLabel, danger, loading, onConfirm, onClose }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={loading}>Keep as is</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>}
    >
      <div className="text-body text-slate">{children}</div>
    </Dialog>
  );
}
