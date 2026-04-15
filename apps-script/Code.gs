const SETTINGS = {
  spreadsheetId: '1qclrbo3_VG-sSNIqMW4j1juzwP3nq_ZaT-y1z6WLafc',
  defaultSheetId: 1243994268,
  apiToken: 'rs_2026_internal_8f3a1c9d2e4b7a6f91c0d55eab23f781',
  payersRangeEndColumn: 12, // A:L
  listHiddenSheets: false,
  historySheetName: '_매칭기록',
  historyHeaders: [
    'recordId',
    'savedAt',
    'payerSheetId',
    'payerSheetTitle',
    'applicantsFileName',
    'countMode',
    'totalPayCount',
    'totalPayAmount',
    'matchedCount',
    'matchedAmount',
    'otherCount',
    'otherAmount',
    'note',
    'snapshotJson',
  ],
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

    if (action === 'historyList') {
      return jsonResponse_(buildHistoryList_(params));
    }

    if (action === 'historyDetail') {
      return jsonResponse_(buildHistoryDetail_(params));
    }

    throw new Error(`Unsupported action: ${action}`);
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error.message || 'Unknown error',
    });
  }
}

function doPost(e) {
  try {
    assertAuthorized_(e);

    const params = (e && e.parameter) || {};
    const body = parseJsonBody_(e);
    const action = stringValue_(params.action || body.action) || 'historySave';

    if (action === 'historySave') {
      return jsonResponse_(saveHistory_(body));
    }

    throw new Error(`Unsupported action: ${action}`);
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

function buildHistoryList_(params) {
  const sheet = getHistorySheet_(false);
  const limit = Math.min(Math.max(numberValue_(params.limit) || 50, 1), 200);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      records: [],
    };
  }

  const rowCount = sheet.getLastRow() - 1;
  const values = sheet.getRange(2, 1, rowCount, SETTINGS.historyHeaders.length).getValues();
  const records = values
    .filter((row) => stringValue_(row[0]))
    .map((row) => historyRecordFromRow_(row, false))
    .sort((left, right) => stringValue_(right.savedAt).localeCompare(stringValue_(left.savedAt)))
    .slice(0, limit);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    records: records,
  };
}

function buildHistoryDetail_(params) {
  const recordId = stringValue_(params.recordId || params.id);
  if (!recordId) {
    throw new Error('recordId is required.');
  }

  const sheet = getHistorySheet_(false);
  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('저장된 매칭 기록이 없습니다.');
  }

  const rowValues = findHistoryRowValues_(sheet, recordId);
  if (!rowValues) {
    throw new Error('선택한 매칭 기록을 찾지 못했습니다.');
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    record: historyRecordFromRow_(rowValues, true),
  };
}

function saveHistory_(payload) {
  const snapshot = normalizeSnapshot_(payload.snapshot || payload);
  const sheet = getHistorySheet_(true);
  const recordId = Utilities.getUuid();
  const savedAt = new Date().toISOString();
  const summary = snapshot.summary || {};

  const storedSnapshot = Object.assign({}, snapshot, {
    recordId: recordId,
    savedAt: savedAt,
  });

  const row = [
    recordId,
    savedAt,
    stringValue_(snapshot.payerSheet && snapshot.payerSheet.sheetId),
    stringValue_(snapshot.payerSheet && snapshot.payerSheet.title),
    stringValue_(snapshot.applicantsFileName),
    stringValue_(snapshot.countMode) || 'tx',
    numberValue_(summary.totalPayCount),
    numberValue_(summary.totalPayAmount),
    numberValue_(summary.matchedCount),
    numberValue_(summary.matchedAmount),
    numberValue_(summary.otherCount),
    numberValue_(summary.otherAmount),
    stringValue_(snapshot.note),
    JSON.stringify(storedSnapshot),
  ];

  sheet.appendRow(row);

  return {
    ok: true,
    generatedAt: savedAt,
    record: historyRecordFromRow_(row, true),
  };
}

function shouldIncludeSheet_(sheet) {
  if (sheet.getName() === SETTINGS.historySheetName) {
    return false;
  }

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
    if (byId && shouldIncludeSheet_(byId)) {
      return byId;
    }
  }

  const titleText = stringValue_(sheetTitle);
  if (titleText) {
    const byTitle = spreadsheet.getSheetByName(titleText);
    if (byTitle && shouldIncludeSheet_(byTitle)) {
      return byTitle;
    }
  }

  return spreadsheet.getSheets().filter((sheet) => (
    shouldIncludeSheet_(sheet) && String(sheet.getSheetId()) === String(SETTINGS.defaultSheetId)
  ))[0] || spreadsheet.getSheets().filter(shouldIncludeSheet_)[0] || null;
}

function getHistorySheet_(createIfMissing) {
  const spreadsheet = SpreadsheetApp.openById(SETTINGS.spreadsheetId);
  let sheet = spreadsheet.getSheetByName(SETTINGS.historySheetName);

  if (!sheet && createIfMissing) {
    sheet = spreadsheet.insertSheet(SETTINGS.historySheetName);
    sheet.hideSheet();
  }

  if (sheet) {
    ensureHistoryHeaders_(sheet);
  }

  return sheet;
}

function ensureHistoryHeaders_(sheet) {
  const width = SETTINGS.historyHeaders.length;
  const existing = sheet.getRange(1, 1, 1, width).getValues()[0];
  const needsHeader = SETTINGS.historyHeaders.some((header, index) => stringValue_(existing[index]) !== header);

  if (needsHeader) {
    sheet.getRange(1, 1, 1, width).setValues([SETTINGS.historyHeaders]);
    sheet.setFrozenRows(1);
  }
}

function findHistoryRowValues_(sheet, recordId) {
  const rowCount = sheet.getLastRow();
  if (rowCount < 2) {
    return null;
  }

  const values = sheet.getRange(2, 1, rowCount - 1, SETTINGS.historyHeaders.length).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (stringValue_(values[index][0]) === recordId) {
      return values[index];
    }
  }

  return null;
}

function historyRecordFromRow_(row, includeSnapshot) {
  const record = {
    recordId: stringValue_(row[0]),
    savedAt: stringValue_(row[1]),
    payerSheet: {
      sheetId: stringValue_(row[2]),
      title: stringValue_(row[3]),
    },
    applicantsFileName: stringValue_(row[4]),
    countMode: stringValue_(row[5]) || 'tx',
    summary: {
      totalPayCount: numberValue_(row[6]),
      totalPayAmount: numberValue_(row[7]),
      matchedCount: numberValue_(row[8]),
      matchedAmount: numberValue_(row[9]),
      otherCount: numberValue_(row[10]),
      otherAmount: numberValue_(row[11]),
    },
    note: stringValue_(row[12]),
  };

  if (includeSnapshot) {
    record.snapshot = parseSnapshotJson_(row[13]);
  }

  return record;
}

function normalizeSnapshot_(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('snapshot payload is required.');
  }

  const summary = snapshot.summary || {};
  const dashboard = Array.isArray(snapshot.dashboard) ? snapshot.dashboard : [];

  if (!dashboard.length) {
    throw new Error('snapshot.dashboard must contain at least one row.');
  }

  return {
    version: 1,
    payerSheet: {
      sheetId: stringValue_(snapshot.payerSheet && snapshot.payerSheet.sheetId),
      title: stringValue_(snapshot.payerSheet && snapshot.payerSheet.title),
    },
    applicantsFileName: stringValue_(snapshot.applicantsFileName),
    countMode: stringValue_(snapshot.countMode) || 'tx',
    note: stringValue_(snapshot.note),
    summary: {
      totalPayCount: numberValue_(summary.totalPayCount),
      totalPayAmount: numberValue_(summary.totalPayAmount),
      matchedCount: numberValue_(summary.matchedCount),
      matchedAmount: numberValue_(summary.matchedAmount),
      otherCount: numberValue_(summary.otherCount),
      otherAmount: numberValue_(summary.otherAmount),
      missingPhoneCount: numberValue_(summary.missingPhoneCount),
      missingPhoneAmountSum: numberValue_(summary.missingPhoneAmountSum),
      totalTracking: numberValue_(summary.totalTracking),
      totalTrackingUniq: numberValue_(summary.totalTrackingUniq),
    },
    dashboard: dashboard.map((row) => ({
      name: stringValue_(row.name),
      pay: numberValue_(row.pay),
      tracking: row.tracking === null || row.tracking === undefined ? null : numberValue_(row.tracking),
      rate: row.rate === null || row.rate === undefined ? null : Number(row.rate) || 0,
      amount: numberValue_(row.amount),
      amountShare: row.amountShare === null || row.amountShare === undefined ? 0 : Number(row.amountShare) || 0,
      isOther: Boolean(row.isOther),
    })),
    missingPhoneRows: Array.isArray(snapshot.missingPhoneRows) ? snapshot.missingPhoneRows.slice(0, 100) : [],
  };
}

function parseSnapshotJson_(value) {
  const text = stringValue_(value);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      parseError: true,
    };
  }
}

function parseJsonBody_(e) {
  const raw = e && e.postData && e.postData.contents;
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('POST body must be valid JSON.');
  }
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

function numberValue_(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
