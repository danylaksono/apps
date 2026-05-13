export function fmt(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (Math.abs(n) >= 1e6) return n.toExponential(3);
  if (Number.isInteger(n)) return n.toString();
  return n.toPrecision(6).replace(/\.?0+$/, '');
}

export function fmtN(v) {
  if (isNaN(v)) return '?';
  if (Math.abs(v) >= 1e6) return v.toExponential(2);
  return parseFloat(v.toPrecision(4)).toString();
}

export function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const COL_HEADERS = [
  'Column', 'Dtype', 'NULLs', 'count', 'mean', 'std',
  'min', '25%', '50%', '75%', 'max', 'unique', 'top', 'freq'
];
