import type { LucideIcon } from 'lucide-react';

export function MetricCard({ label, value, detail, icon: Icon, tone = 'purple' }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: 'purple' | 'orange' | 'green' | 'blue' }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon tone-${tone}`}><Icon size={16} /></span></div><div className="stat-value">{value}</div><div className={`stat-change ${detail.startsWith('—') ? 'muted' : ''}`}>{detail}</div></div>; }
