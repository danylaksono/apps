import { COL_HEADERS } from './format';

export function generateCSV(results) {
  if (!results.length) return;

  const headers = ['LA', ...COL_HEADERS];
  const rowData = results.flatMap(r =>
    r.rows.map(row => [
      r.laCode, row.col, row.dtype, row.nullCount,
      row.count ?? '', row.mean ?? '', row.std ?? '',
      row.min ?? '', row.q25 ?? '', row.q50 ?? '', row.q75 ?? '', row.max ?? '',
      row.unique ?? '', row.top ?? '', row.freq ?? ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  );

  const csv = [headers.join(','), ...rowData].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'geoparquet_qa_summary.csv';
  a.click();
  URL.revokeObjectURL(url);
}
