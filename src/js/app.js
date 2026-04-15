import {
  fetchHistoryDetail,
  fetchHistoryList,
  fetchSheetCatalog,
  fetchSheetGrid,
  saveHistorySnapshot,
} from './api.js';
import { HISTORY_SPREADSHEET_ID } from './config.js';
import { createHistorySnapshot } from './history.js';
import { computeResults, parseApplicants, parsePayersFromGrid } from './parsers.js';
import {
  appState,
  getHistoryRecord,
  rememberHistoryRecord,
  selectedSheet,
  setSelectedSheet,
} from './state.js';
import { $, readWorkbookGrid } from './utils.js';
import { renderAll } from './render.js';

function assertHistorySpreadsheet(payload) {
  const backendSpreadsheetId = String(payload?.spreadsheetId || '').trim();
  if (backendSpreadsheetId && backendSpreadsheetId !== HISTORY_SPREADSHEET_ID) {
    throw new Error(
      `현재 백엔드가 저장 기록을 다른 시트(${backendSpreadsheetId})에 쓰고 있습니다. Apps Script가 아직 예전 배포본입니다. 새 Code.gs로 다시 배포해 주세요.`,
    );
  }
}

async function loadCatalog() {
  appState.loadingCatalog = true;
  appState.error = '';
  renderAll();

  try {
    const payload = await fetchSheetCatalog();
    appState.sheetCatalog = payload.sheets || [];
    appState.generatedAt = payload.generatedAt || appState.generatedAt;

    const current = selectedSheet();
    const nextSheet = current
      || appState.sheetCatalog.find((sheet) => String(sheet.sheetId) === String(payload.defaultSheetId))
      || appState.sheetCatalog[0]
      || null;

    setSelectedSheet(nextSheet);
  } catch (error) {
    appState.error = error.message || '결제자 시트 목록을 불러오지 못했습니다.';
  } finally {
    appState.loadingCatalog = false;
    renderAll();
  }
}

async function loadSelectedSheet() {
  const sheet = selectedSheet();
  if (!sheet) {
    appState.payers = null;
    appState.results = null;
    renderAll();
    return;
  }

  appState.loadingSheet = true;
  appState.error = '';
  appState.results = null;
  renderAll();

  try {
    const payload = await fetchSheetGrid(sheet);
    appState.generatedAt = payload.generatedAt || appState.generatedAt;
    appState.payers = parsePayersFromGrid(payload.grid || []);
  } catch (error) {
    appState.payers = null;
    appState.error = error.message || '선택한 결제자 시트를 불러오지 못했습니다.';
  } finally {
    appState.loadingSheet = false;
    renderAll();
  }
}

async function handleApplicantsFile(file) {
  if (!file) return;

  try {
    const grid = await readWorkbookGrid(file);
    appState.applicants = parseApplicants(grid);
    appState.applicantsFileName = file.name || '';
    appState.results = null;
    appState.error = '';
  } catch (error) {
    appState.applicants = null;
    appState.applicantsFileName = '';
    appState.error = error.message || '신청자 파일을 읽지 못했습니다.';
  }

  renderAll();
}

function runMatching() {
  if (!appState.payers) {
    appState.error = '결제자 시트를 먼저 선택해 주세요.';
    renderAll();
    return;
  }

  if (!appState.applicants) {
    appState.error = '무료강의 신청자 파일을 먼저 업로드해 주세요.';
    renderAll();
    return;
  }

  appState.results = computeResults(appState.payers, appState.applicants, $('countMode').value);
  appState.error = '';
  renderAll();
}

async function ensureHistoryRecord(recordId) {
  if (!recordId) return null;

  const cached = getHistoryRecord(recordId);
  if (cached?.snapshot) {
    return cached;
  }

  const payload = await fetchHistoryDetail(recordId);
  assertHistorySpreadsheet(payload);
  if (payload.record) {
    rememberHistoryRecord(payload.record);
    appState.generatedAt = payload.generatedAt || appState.generatedAt;
  }

  return payload.record || null;
}

async function loadHistoryList() {
  appState.loadingHistory = true;
  renderAll();

  try {
    const payload = await fetchHistoryList();
    assertHistorySpreadsheet(payload);
    appState.historyList = payload.records || [];
    appState.generatedAt = payload.generatedAt || appState.generatedAt;

    appState.historyList.forEach((record) => {
      const previous = getHistoryRecord(record.recordId);
      rememberHistoryRecord(previous ? { ...previous, ...record } : record);
    });

    if (!appState.historyList.some((record) => record.recordId === appState.previewRecordId)) {
      appState.previewRecordId = '';
    }

    if (!appState.historyList.some((record) => record.recordId === appState.compareBaseId)) {
      appState.compareBaseId = '';
    }

    if (!appState.historyList.some((record) => record.recordId === appState.compareTargetId)) {
      appState.compareTargetId = '';
    }

    const historyIds = [...new Set([appState.previewRecordId, appState.compareBaseId, appState.compareTargetId].filter(Boolean))];
    for (const recordId of historyIds) {
      await ensureHistoryRecord(recordId);
    }
  } catch (error) {
    appState.error = error.message || '저장 기록을 불러오지 못했습니다.';
  } finally {
    appState.loadingHistory = false;
    renderAll();
  }
}

async function pickHistoryForCompare(slot, recordId) {
  try {
    appState.error = '';
    await ensureHistoryRecord(recordId);

    if (slot === 'base') {
      appState.compareBaseId = recordId;
    } else {
      appState.compareTargetId = recordId;
    }
    appState.pageMode = 'compare';
  } catch (error) {
    appState.error = error.message || '비교 기록을 불러오지 못했습니다.';
  }

  renderAll();
}

async function previewHistory(recordId) {
  try {
    appState.error = '';
    await ensureHistoryRecord(recordId);
    appState.previewRecordId = recordId;
    appState.pageMode = 'dashboard';
    appState.historyModalOpen = false;
  } catch (error) {
    appState.error = error.message || '저장 기록을 불러오지 못했습니다.';
  }

  renderAll();
}

async function saveCurrentHistory() {
  if (!appState.results) {
    appState.error = '먼저 매칭을 실행한 뒤 저장해 주세요.';
    renderAll();
    return;
  }

  appState.savingHistory = true;
  appState.error = '';
  renderAll();

  try {
    const snapshot = createHistorySnapshot({
      sheet: selectedSheet(),
      applicantsFileName: appState.applicantsFileName,
      payers: appState.payers,
      applicants: appState.applicants,
      results: appState.results,
      countMode: $('countMode').value,
      note: $('historyNote').value.trim(),
    });

    const payload = await saveHistorySnapshot(snapshot);
    assertHistorySpreadsheet(payload);
    if (payload.record) {
      rememberHistoryRecord(payload.record);
      appState.lastSavedRecordId = payload.record.recordId;
      appState.previewRecordId = payload.record.recordId;
      appState.pageMode = 'dashboard';
    }

    $('historyNote').value = '';
    await loadHistoryList();
  } catch (error) {
    appState.error = error.message || '매칭 기록 저장에 실패했습니다.';
  } finally {
    appState.savingHistory = false;
    renderAll();
  }
}

function bindEvents() {
  $('dashboardPageBtn').addEventListener('click', () => {
    appState.pageMode = 'dashboard';
    renderAll();
  });

  $('comparisonPageBtn').addEventListener('click', () => {
    appState.pageMode = 'compare';
    renderAll();
  });

  $('refreshBtn').addEventListener('click', async () => {
    await loadCatalog();
    await loadSelectedSheet();
  });

  $('sheetSearchInput').addEventListener('input', (event) => {
    appState.sheetQuery = event.target.value || '';
    renderAll();
  });

  $('sheetSelect').addEventListener('change', async (event) => {
    const sheet = appState.sheetCatalog.find((item) => String(item.sheetId) === String(event.target.value)) || null;
    setSelectedSheet(sheet);
    await loadSelectedSheet();
  });

  $('countMode').addEventListener('change', () => {
    if (appState.results && appState.payers && appState.applicants) {
      appState.results = computeResults(appState.payers, appState.applicants, $('countMode').value);
    }
    renderAll();
  });

  $('applicantsFile').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    await handleApplicantsFile(file);
  });

  $('runBtn').addEventListener('click', () => {
    runMatching();
  });

  $('saveHistoryBtn').addEventListener('click', async () => {
    await saveCurrentHistory();
  });

  $('clearPreviewBtn').addEventListener('click', () => {
    appState.previewRecordId = '';
    appState.pageMode = 'dashboard';
    renderAll();
  });

  $('clearCompareBtn').addEventListener('click', () => {
    appState.compareBaseId = '';
    appState.compareTargetId = '';
    renderAll();
  });

  $('openHistoryModalBtn').addEventListener('click', () => {
    appState.historyModalOpen = true;
    renderAll();
    $('historySearchInput')?.focus();
  });

  $('closeHistoryModalBtn').addEventListener('click', () => {
    appState.historyModalOpen = false;
    renderAll();
  });

  $('reloadHistoryBtn').addEventListener('click', async () => {
    await loadHistoryList();
  });

  $('historySearchInput').addEventListener('input', (event) => {
    appState.historySearchQuery = event.target.value || '';
    renderAll();
  });

  $('historyModal').addEventListener('click', (event) => {
    if (event.target.matches('[data-history-modal-close]')) {
      appState.historyModalOpen = false;
      renderAll();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && appState.historyModalOpen) {
      appState.historyModalOpen = false;
      renderAll();
    }
  });

  $('historyModalTbody').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-history-action]');
    if (!button) return;

    const action = button.getAttribute('data-history-action');
    const recordId = button.getAttribute('data-record-id');
    if (!recordId) return;

    if (action === 'preview') {
      await previewHistory(recordId);
      return;
    }

    if (action === 'clear-preview') {
      appState.previewRecordId = '';
      renderAll();
      return;
    }

    if (action === 'pick-base') {
      await pickHistoryForCompare('base', recordId);
      return;
    }

    if (action === 'clear-base') {
      appState.compareBaseId = '';
      renderAll();
      return;
    }

    if (action === 'pick-target') {
      await pickHistoryForCompare('target', recordId);
      return;
    }

    if (action === 'clear-target') {
      appState.compareTargetId = '';
      renderAll();
    }
  });
}

async function bootstrap() {
  bindEvents();
  renderAll();
  await loadCatalog();
  await loadSelectedSheet();
  await loadHistoryList();
}

bootstrap();
