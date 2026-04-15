export const APP_TITLE = '무료강의 결제 매칭 보드';
export const API_BASE = window.__RS_APP_CONFIG__?.apiBaseUrl || '/api/settlements';
export const STORAGE_KEY = 'classaround-rs-matching-v4';
export const HISTORY_SPREADSHEET_ID = '1c4U9TwFK9wNmSmiN6lgl9iaQlaC57x7DcscfLtzb-pA';
export const HISTORY_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1c4U9TwFK9wNmSmiN6lgl9iaQlaC57x7DcscfLtzb-pA/edit?gid=549932056#gid=549932056';

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

export const BUCKET_COLORS = {
  google: '#4f74c8',
  meta: '#22b36b',
  others: '#7c3aed',
  unmatched: OTHER_COLOR,
};
