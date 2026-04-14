export const APP_TITLE = '무료강의 결제 매칭 보드';
export const API_BASE = window.__RS_APP_CONFIG__?.apiBaseUrl || '/api/settlements';
export const STORAGE_KEY = 'classaround-rs-matching-v4';

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
  '#4f74c8',
  '#22b36b',
  '#7c3aed',
  '#f59e0b',
  '#06b6d4',
  '#0f766e',
  '#8b5cf6',
  '#84cc16',
  '#14b8a6',
  '#1d4ed8',
  '#9333ea',
  '#0891b2',
];

export const OTHER_COLOR = '#ef5b3f';
export const EMPTY_DONUT_COLOR = '#edf2f7';
export const HISTORY_LIMIT = 50;
