import { AlertCircle, RefreshCw } from 'lucide-react';

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="inline-error"><AlertCircle size={16} /> <span style={{ flex: 1 }}>{message}</span>{onRetry && <button className="button button-ghost" onClick={onRetry} aria-label="Retry"><RefreshCw size={14} /></button>}</div>; }
