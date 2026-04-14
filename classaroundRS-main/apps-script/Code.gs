/**
 * 기존 매칭 보드용 Apps Script 백엔드
 *
 * 역할:
 * - 고정된 결제자 원본 스프레드시트의 시트 목록 제공
 * - 선택된 시트의 A:L 범위를 JSON으로 제공
 *
 * 프런트엔드는 별도 Google 로그인 없이 이 API만 호출합니다.
 * 무료강의 신청자 파일은 브라우저에서 직접 업로드/파싱합니다.
 */
const SETTINGS = {
  spreadsheetId: '1qclrbo3_VG-sSNIqMW4j1juzwP3nq_ZaT-y1z6WLafc',
  defaultSheetId: 1243994268,
  apiToken: 'PUT_LONG_RANDOM_TOKEN_HERE',
  payersRangeEndColumn: 12, // A:L
  listHiddenSheets: false,
};

function doGet(e) {
  try {
    assertAuthorized_(e);

    const params = (e && e.parameter) || {};
    const action = stringValue_(params.action) || 'health';

    if (action === 'health') {
      return jsonResponse_({
        ok: true,
        generatedAt: new Date().toISOString(),
        spreadsheetId: SETTINGS.spreadsheetId,
        defaultSheetId: SETTINGS.defaultSheetId,
      });
    }

    if (action === 'catalog') {
      return jsonResponse_(buildCatalog_());
    }

    if (action === 'sheetGrid') {
      return jsonResponse_(buildSheetGrid_(params));
    }

    throw new Error(`지원하지 않는 action 입니다: ${action}`);
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error.message || 'Unknown error',
    });
  }
}

function buildCatalog_() {
  const spreadsheet = SpreadsheetApp.openById(SETTINGS.spreadsheetId);
  const sheets = spreadsheet.getSheets()
    .filter((sheet) => shouldIncludeSheet_(sheet))
    .map((sheet) => ({
      sheetId: sheet.getSheetId(),
      title: sheet.getName(),
    }));

  const defaultSheet = sheets.filter((sheet) => String(sheet.sheetId) === String(SETTINGS.defaultSheetId))[0] || sheets[0] || null;

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    spreadsheetId: SETTINGS.spreadsheetId,
    defaultSheetId: defaultSheet ? defaultSheet.sheetId : '',
    sheets: sheets,
  };
}

function buildSheetGrid_(params) {
  const spreadsheet = SpreadsheetApp.openById(SETTINGS.spreadsheetId);
  const sheet = findSheet_(spreadsheet, params.sheetId, params.sheetTitle);
  if (!sheet) {
    throw new Error('선택한 결제자 시트를 찾지 못했습니다.');
  }

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const range = sheet.getRange(1, 1, lastRow, SETTINGS.payersRangeEndColumn);
  const grid = range.getDisplayValues();

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    spreadsheetId: SETTINGS.spreadsheetId,
    sheet: {
      sheetId: sheet.getSheetId(),
      title: sheet.getName(),
      rowCount: grid.length,
    },
    grid: grid,
  };
}

function shouldIncludeSheet_(sheet) {
  if (SETTINGS.listHiddenSheets) {
    return true;
  }

  try {
    return !sheet.isSheetHidden();
  } catch (error) {
    return true;
  }
}

function findSheet_(spreadsheet, sheetId, sheetTitle) {
  const idText = stringValue_(sheetId);
  if (idText) {
    const targetId = Number(idText);
    const byId = spreadsheet.getSheets().filter((sheet) => sheet.getSheetId() === targetId)[0];
    if (byId) {
      return byId;
    }
  }

  const titleText = stringValue_(sheetTitle);
  if (titleText) {
    return spreadsheet.getSheetByName(titleText);
  }

  return spreadsheet.getSheets().filter((sheet) => String(sheet.getSheetId()) === String(SETTINGS.defaultSheetId))[0]
    || spreadsheet.getSheets()[0]
    || null;
}

function assertAuthorized_(e) {
  if (!SETTINGS.apiToken || SETTINGS.apiToken.indexOf('PUT_') === 0) {
    return;
  }

  const incomingToken = stringValue_((e && e.parameter && e.parameter.token) || '');
  if (incomingToken !== SETTINGS.apiToken) {
    throw new Error('Unauthorized');
  }
}

function stringValue_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
