import type { InvoiceStatus, OrderStatus } from '../../types';

export function StatusPill({ status }: { status: InvoiceStatus | OrderStatus }) {
  return <span className={`status-pill status-${status}`}>{status}</span>;
}
