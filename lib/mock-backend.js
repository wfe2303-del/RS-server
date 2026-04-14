const fs = require('fs');
const path = require('path');

function readPayload(filePath) {
  const resolvedPath = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
}

function normalizeLegacySheets(payload) {
  return {
    generatedAt: payload.generatedAt || new Date().toISOString(),
    defaultSheetId: String(payload.defaultSheetId || payload.sheets?.[0]?.sheetId || ''),
    sheets: Array.isArray(payload.sheets)
      ? payload.sheets.map((sheet) => ({
          sheetId: String(sheet.sheetId || ''),
          title: String(sheet.title || ''),
          grid: Array.isArray(sheet.grid) ? sheet.grid : [],
        }))
      : [],
  };
}

function buildLegacyPayload(normalized, action, params) {
  if (action === 'health') {
    return {
      ok: true,
      generatedAt: normalized.generatedAt,
      mode: 'mock',
      defaultSheetId: normalized.defaultSheetId,
    };
  }

  if (action === 'catalog') {
    return {
      ok: true,
      generatedAt: normalized.generatedAt,
      defaultSheetId: normalized.defaultSheetId,
      sheets: normalized.sheets.map((sheet) => ({
        sheetId: sheet.sheetId,
        title: sheet.title,
      })),
    };
  }

  if (action === 'sheetGrid') {
    const targetSheet = normalized.sheets.find((sheet) => (
      (params.sheetId && String(sheet.sheetId) === String(params.sheetId))
      || (params.sheetTitle && sheet.title === params.sheetTitle)
    )) || normalized.sheets[0];

    if (!targetSheet) {
      return {
        ok: false,
        error: '선택한 시트를 찾지 못했습니다.',
      };
    }

    return {
      ok: true,
      generatedAt: normalized.generatedAt,
      sheet: {
        sheetId: targetSheet.sheetId,
        title: targetSheet.title,
        rowCount: targetSheet.grid.length,
      },
      grid: targetSheet.grid,
    };
  }

  if (action === 'historyList') {
    return {
      ok: true,
      generatedAt: normalized.generatedAt,
      records: [],
    };
  }

  if (action === 'historyDetail') {
    return {
      ok: false,
      error: 'Mock history detail is not available.',
    };
  }

  return {
    ok: false,
    error: `Unsupported mock action: ${action}`,
  };
}

function buildMockPayload({ filePath, action, month, lectureId, sheetId, sheetTitle }) {
  const payload = readPayload(filePath);

  if (Array.isArray(payload.sheets)) {
    return buildLegacyPayload(normalizeLegacySheets(payload), action, {
      sheetId,
      sheetTitle,
    });
  }

  return {
    ok: false,
    error: 'Unsupported mock file format.',
    detail: {
      action,
      month,
      lectureId,
      sheetId,
      sheetTitle,
    },
  };
}

module.exports = {
  buildMockPayload,
};
