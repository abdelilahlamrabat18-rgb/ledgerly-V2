import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

export function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><div><h2 className="modal-title">{title}</h2>{subtitle && <p className="modal-subtitle">{subtitle}</p>}</div><button className="button button-ghost" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></header><div className="modal-body">{children}</div></section></div>;
}
