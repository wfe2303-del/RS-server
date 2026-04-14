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
  '#ef5b3f',
  '#22b36b',
  '#1a1f5c',
  '#7a9bff',
  '#ff7a5f',
  '#55d18a',
  '#2f49a5',
  '#9db6ff',
  '#4fd59a',
];

export const OTHER_COLOR = '#ef5b3f';
export const EMPTY_DONUT_COLOR = '#edf2f7';
export const HISTORY_LIMIT = 50;
