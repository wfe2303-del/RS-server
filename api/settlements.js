const path = require('path');
const { buildMockPayload } = require('../lib/mock-backend');

module.exports = async (request, response) => {
  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({
      ok: false,
      error: 'Method not allowed',
    }));
    return;
  }

  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  const appsScriptToken = process.env.APPS_SCRIPT_TOKEN || '';
  const mockFile = process.env.MOCK_SETTLEMENTS_FILE || '';

  if (!appsScriptUrl && mockFile) {
    try {
      const payload = buildMockPayload({
        filePath: path.resolve(process.cwd(), mockFile),
        action: String(request.query?.action || 'health'),
        month: String(request.query?.month || ''),
        lectureId: String(request.query?.id || ''),
        sheetId: String(request.query?.sheetId || ''),
        sheetTitle: String(request.query?.sheetTitle || ''),
      });
      response.statusCode = payload.ok === false ? 404 : 200;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify(payload));
      return;
    } catch (error) {
      response.statusCode = 500;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({
        ok: false,
        error: `Failed to load MOCK_SETTLEMENTS_FILE: ${error.message}`,
      }));
      return;
    }
  }

  if (!appsScriptUrl) {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({
      ok: false,
      error: 'Missing APPS_SCRIPT_URL environment variable.',
    }));
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(appsScriptUrl);
  } catch {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({
      ok: false,
      error: 'APPS_SCRIPT_URL is not a valid URL.',
    }));
    return;
  }

  Object.entries(request.query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => targetUrl.searchParams.append(key, String(item)));
      return;
    }

    if (value !== undefined && value !== null && value !== '') {
      targetUrl.searchParams.set(key, String(value));
    }
  });

  if (appsScriptToken) {
    targetUrl.searchParams.set('token', appsScriptToken);
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const body = await upstream.text();
    response.statusCode = upstream.status;
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(body);
  } catch (error) {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({
      ok: false,
      error: `Failed to reach Apps Script backend: ${error.message}`,
    }));
  }
};
