import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function MetricCard({ label, value, detail, icon: Icon, tone = 'purple', trailing }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: 'purple' | 'orange' | 'green' | 'blue'; trailing?: ReactNode }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon tone-${tone}`}><Icon size={16} /></span></div><div className="stat-value">{value}</div><div className={`stat-change ${detail.startsWith('—') ? 'muted' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{detail}{trailing}</div></div>; }
