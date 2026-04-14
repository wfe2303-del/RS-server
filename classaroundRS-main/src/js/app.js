import { fetchSheetCatalog, fetchSheetGrid } from './api.js';
import { computeResults, parseApplicants, parsePayersFromGrid } from './parsers.js';
import { appState, selectedSheet, setSelectedSheet } from './state.js';
import { $, readWorkbookGrid } from './utils.js';
import { renderAll } from './render.js';

async function loadCatalog() {
  appState.loadingCatalog = true;
  appState.error = '';
  renderAll();

  try {
    const payload = await fetchSheetCatalog();
    appState.sheetCatalog = payload.sheets || [];
    appState.generatedAt = payload.generatedAt || '';

    const current = selectedSheet();
    const nextSheet = current
      || appState.sheetCatalog.find((sheet) => String(sheet.sheetId) === String(payload.defaultSheetId))
      || appState.sheetCatalog[0]
      || null;

    setSelectedSheet(nextSheet);
    appState.error = '';
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
    appState.error = '';
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

function bindEvents() {
  $('refreshBtn').addEventListener('click', async () => {
    await loadCatalog();
    await loadSelectedSheet();
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
}

async function bootstrap() {
  bindEvents();
  renderAll();
  await loadCatalog();
  await loadSelectedSheet();
}

bootstrap();
