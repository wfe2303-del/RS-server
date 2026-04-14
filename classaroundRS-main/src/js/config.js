export const APP_TITLE = '무료강의 결제 매칭 보드';
export const API_BASE = window.__RS_APP_CONFIG__?.apiBaseUrl || '/api/settlements';
export const STORAGE_KEY = 'classaround-rs-matching-v3';

export const PAYERS_RULES = {
  nameCol: 'C',
  phoneCol: 'D',
  amountCol: 'L',
  startRow: 2,
  excludeZeroAmount: true,
};

export const APPLICANTS_RULES = {
  mediaCol: 'D',
  nameCol: 'F',
  phoneCol: 'G',
  startRow: 2,
};

export const PALETTE = [
  '#0f766e',
  '#0284c7',
  '#b45309',
  '#65a30d',
  '#dc2626',
  '#7c3aed',
  '#1d4ed8',
  '#0ea5e9',
  '#84cc16',
  '#475569',
];

export const OTHER_COLOR = '#b91c1c';
export const EMPTY_DONUT_COLOR = '#e7e5e4';
