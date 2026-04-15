import { STORAGE_KEY } from './config.js';
import { readStoredJson, writeStoredJson } from './utils.js';

const stored = readStoredJson(STORAGE_KEY) || {};

export const appState = {
  sheetCatalog: [],
  selectedSheetId: stored.selectedSheetId || '',
  selectedSheetTitle: stored.selectedSheetTitle || '',
  pageMode: 'dashboard',
  sheetQuery: '',
  historySearchQuery: '',
  historyModalOpen: false,
  generatedAt: '',
  loadingCatalog: false,
  loadingSheet: false,
  loadingHistory: false,
  savingHistory: false,
  payers: null,
  applicants: null,
  applicantsFileName: '',
  results: null,
  historyList: [],
  historyRecords: {},
  previewRecordId: '',
  compareBaseId: '',
  compareTargetId: '',
  lastSavedRecordId: '',
  error: '',
};

export function persistSelection() {
  writeStoredJson(STORAGE_KEY, {
    selectedSheetId: appState.selectedSheetId,
    selectedSheetTitle: appState.selectedSheetTitle,
  });
}

export function setSelectedSheet(sheet) {
  appState.selectedSheetId = sheet?.sheetId ? String(sheet.sheetId) : '';
  appState.selectedSheetTitle = sheet?.title || '';
  persistSelection();
}

export function selectedSheet() {
  return appState.sheetCatalog.find((sheet) => String(sheet.sheetId) === String(appState.selectedSheetId)) || null;
}

export function rememberHistoryRecord(record) {
  if (!record?.recordId) return;
  appState.historyRecords[record.recordId] = record;
}

export function getHistoryRecord(recordId) {
  return appState.historyRecords[recordId] || null;
}
