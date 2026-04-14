export const $ = (id) => document.getElementById(id);

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

export function colToIdx(letter) {
  let number = 0;
  const normalized = String(letter || '').toUpperCase();

  for (let i = 0; i < normalized.length; i += 1) {
    number = number * 26 + (normalized.charCodeAt(i) - 64);
  }

  return number - 1;
}

export function normalizePhone(value) {
  if (value === null || value === undefined) return '';

  let text = typeof value === 'number' ? String(Math.trunc(value)) : String(value).trim();
  if (!text) return '';

  if (/[eE]/.test(text) && /^[\d.+-]+[eE][+-]?\d+$/.test(text)) {
    const parsed = Number(text);
    if (Number.isFinite(parsed)) {
      text = String(Math.trunc(parsed));
    }
  }

  let digits = text.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('82')) {
    digits = digits.slice(2);
    if (!digits.startsWith('0')) {
      digits = `0${digits}`;
    }
  }

  if (digits.length === 10 && digits.startsWith('10')) {
    digits = `0${digits}`;
  }

  return digits;
}

export function parseAmount(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const cleaned = String(value).trim().replace(/[^\d.-]/g, '');
  if (!cleaned) return 0;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCount(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

export function formatKRW(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}원`;
}

export function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

export function formatDateTime(value) {
  if (!value) return '-';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export async function readWorkbookGrid(file) {
  const extension = (file.name.split('.').pop() || '').toLowerCase();

  if (extension === 'csv') {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: 'string' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
}

export function readStoredJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
