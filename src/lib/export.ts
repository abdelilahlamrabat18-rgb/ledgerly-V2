export function toCSV<T extends Record<string, unknown>>(rows: T[], headers: { key: keyof T | string; label: string }[]): string {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = headers.map((h) => escape(h.label)).join(',');
  const dataLines = rows.map((row) => headers.map((h) => escape(row[h.key as keyof T] ?? '')).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}