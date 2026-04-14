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
      throw new Error('백엔드가 JSON 대신 HTML을 반환했습니다. Apps Script 웹앱 URL이 잘못됐거나 새 배포가 반영되지 않았습니다.');
    }

    throw new Error(body || `API 호출에 실패했습니다. (${response.status})`);
  }

  if (!response.ok || payload?.ok === false) {
    const errorText = payload?.error || `API 호출에 실패했습니다. (${response.status})`;

    if (/historySave/i.test(errorText) || /지원하지 않는 action/i.test(errorText)) {
      throw new Error('Apps Script가 아직 저장 API를 모릅니다. 최신 Code.gs로 다시 붙여넣고 웹앱을 새 버전으로 재배포해 주세요.');
    }

    if (/Unauthorized/i.test(errorText)) {
      throw new Error('Apps Script 토큰이 일치하지 않습니다. APPS_SCRIPT_TOKEN과 Code.gs의 apiToken을 같은 값으로 맞춰 주세요.');
    }

    throw new Error(errorText);
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
