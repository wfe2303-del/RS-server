import { PAYERS_SOURCE } from './config.js';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function fetchJson(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Google Sheets API 요청에 실패했습니다. (${response.status}) ${body}`);
  }

  return response.json();
}

export async function fetchSheetCatalog(accessToken) {
  const url = `${SHEETS_BASE}/${PAYERS_SOURCE.spreadsheetId}?fields=sheets(properties(sheetId,title))`;
  const data = await fetchJson(url, accessToken);
  return (data.sheets || []).map((sheet) => ({
    sheetId: sheet.properties.sheetId,
    title: sheet.properties.title,
  }));
}

export async function fetchSheetGrid(accessToken, sheetTitle) {
  const encodedRange = encodeURIComponent(`'${sheetTitle}'!A:L`);
  const url = `${SHEETS_BASE}/${PAYERS_SOURCE.spreadsheetId}/values/${encodedRange}?majorDimension=ROWS`;
  const data = await fetchJson(url, accessToken);
  return data.values || [];
}
