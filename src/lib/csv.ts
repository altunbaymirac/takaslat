/**
 * CSV export utility — tarayıcıda dosya indirir
 */

function escape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Virgül, çift tırnak veya newline varsa quote
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCSV<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: { key: keyof T; label: string }[],
): void {
  if (rows.length === 0) {
    alert('İndirilecek veri yok');
    return;
  }

  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows
    .map((r) => columns.map((c) => escape(r[c.key])).join(','))
    .join('\n');

  const csv = '﻿' + header + '\n' + body; // BOM for Excel UTF-8

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
