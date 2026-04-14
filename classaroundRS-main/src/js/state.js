import { STORAGE_KEY } from './config.js';
import { readStoredJson, writeStoredJson } from './utils.js';

const stored = readStoredJson(STORAGE_KEY) || {};

export const appState = {
  sheetCatalog: [],
  selectedSheetId: stored.selectedSheetId || '',
  selectedSheetTitle: stored.selectedSheetTitle || '',
  generatedAt: '',
  loadingCatalog: false,
  loadingSheet: false,
  payers: null,
  applicants: null,
  applicantsFileName: '',
  results: null,
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
