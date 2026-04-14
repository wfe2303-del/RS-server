import { API_BASE, HISTORY_LIMIT } from './config.js';

async function request(params = {}, options = {}) {
  const method = options.method || 'GET';
  const url = new URL(API_BASE, window.location.href);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    },
    body: method === 'POST' ? JSON.stringify(options.body || {}) : undefined,
    cache: 'no-store',
  });

  const body = await response.text();
  let payload = null;

  try {
    payload = body ? JSON.parse(body) : null;
  } catch {
    const looksLikeHtml = /<!doctype html|<html/i.test(body || '');
    if (looksLikeHtml) {
      throw new Error('백엔드가 JSON 대신 HTML을 반환했습니다. APPS_SCRIPT_URL 또는 Apps Script 배포 URL 설정을 확인해 주세요.');
    }

    throw new Error(body || `API 호출에 실패했습니다. (${response.status})`);
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `API 호출에 실패했습니다. (${response.status})`);
  }

  return payload;
}

export function fetchSheetCatalog() {
  return request({
    action: 'catalog',
  });
}

export function fetchSheetGrid(sheet) {
  return request({
    action: 'sheetGrid',
    sheetId: sheet?.sheetId || '',
    sheetTitle: sheet?.title || '',
  });
}

export function fetchHistoryList(limit = HISTORY_LIMIT) {
  return request({
    action: 'historyList',
    limit,
  });
}

export function fetchHistoryDetail(recordId) {
  return request({
    action: 'historyDetail',
    recordId,
  });
}

export function saveHistorySnapshot(snapshot) {
  return request(
    { action: 'historySave' },
    {
      method: 'POST',
      body: { snapshot },
    },
  );
}
