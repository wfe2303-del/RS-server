import { API_BASE } from './config.js';

async function request(params) {
  const url = new URL(API_BASE, window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await response.text();
  let payload = null;

  try {
    payload = body ? JSON.parse(body) : null;
  } catch {
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
