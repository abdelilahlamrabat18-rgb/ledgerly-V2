import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

export function ConfirmDialog({ title, message, onConfirm, onClose, loading = false }: { title: string; message: string; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  return <Modal title={title} onClose={onClose}><div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><div className="empty-icon" style={{ margin: 0, color: '#d45761', background: '#fff0f1', flexShrink: 0 }}><AlertTriangle size={19} /></div><p style={{ margin: 2, color: '#667385', fontSize: 12, lineHeight: 1.55 }}>{message}</p></div><div className="form-actions"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-danger" disabled={loading} onClick={onConfirm}>{loading ? 'Deleting…' : 'Delete permanently'}</button></div></Modal>;
}
