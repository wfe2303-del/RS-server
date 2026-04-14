const path = require('path');
const { buildMockPayload } = require('../lib/mock-backend');

async function readRequestBody(request) {
  if (request.body !== undefined && request.body !== null) {
    if (typeof request.body === 'string') {
      return request.body;
    }

    if (Buffer.isBuffer(request.body)) {
      return request.body.toString('utf8');
    }

    return JSON.stringify(request.body);
  }

  return await new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

module.exports = async (request, response) => {
  if (!['GET', 'POST'].includes(request.method || 'GET')) {
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
    if (request.method === 'POST') {
      response.statusCode = 501;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({
        ok: false,
        error: 'Mock mode does not support POST history saves.',
      }));
      return;
    }

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
    const body = request.method === 'POST' ? await readRequestBody(request) : undefined;
    const upstream = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: {
        Accept: 'application/json',
        ...(request.method === 'POST'
          ? { 'Content-Type': request.headers['content-type'] || 'application/json; charset=utf-8' }
          : {}),
      },
      body,
      redirect: 'follow',
    });

    const upstreamBody = await upstream.text();
    response.statusCode = upstream.status;
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(upstreamBody);
  } catch (error) {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({
      ok: false,
      error: `Failed to reach Apps Script backend: ${error.message}`,
    }));
  }
};
