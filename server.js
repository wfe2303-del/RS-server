const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildMockPayload } = require('./lib/mock-backend');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8080);
const ROOT_DIR = __dirname;
const API_PATH = '/api/settlements';

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function safeResolve(urlPathname) {
  const decoded = decodeURIComponent(urlPathname.split('?')[0]);
  const cleaned = decoded === '/' ? '/index.html' : decoded;
  const normalized = path.normalize(cleaned).replace(/^(\.\.[/\\])+/, '');
  const resolved = path.join(ROOT_DIR, normalized);

  if (!resolved.startsWith(ROOT_DIR)) {
    return null;
  }

  return resolved;
}

function sendFile(filePath, response) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Internal server error');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });
    response.end(data);
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function proxyAppsScript(request, response) {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  const appsScriptToken = process.env.APPS_SCRIPT_TOKEN || '';
  const mockFile = process.env.MOCK_SETTLEMENTS_FILE || '';
  const incomingUrl = new URL(request.url || API_PATH, `http://${request.headers.host || `localhost:${PORT}`}`);

  if (!appsScriptUrl && mockFile) {
    if (request.method === 'POST') {
      sendJson(response, 501, {
        ok: false,
        error: 'Mock mode does not support POST history saves.',
      });
      return;
    }

    try {
      const payload = buildMockPayload({
        filePath: path.resolve(ROOT_DIR, mockFile),
        action: incomingUrl.searchParams.get('action') || 'health',
        month: incomingUrl.searchParams.get('month') || '',
        lectureId: incomingUrl.searchParams.get('id') || '',
        sheetId: incomingUrl.searchParams.get('sheetId') || '',
        sheetTitle: incomingUrl.searchParams.get('sheetTitle') || '',
      });
      sendJson(response, payload.ok === false ? 404 : 200, payload);
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: `Failed to load MOCK_SETTLEMENTS_FILE: ${error.message}`,
      });
    }
    return;
  }

  if (!appsScriptUrl) {
    sendJson(response, 500, {
      ok: false,
      error: 'Missing APPS_SCRIPT_URL environment variable.',
    });
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(appsScriptUrl);
  } catch {
    sendJson(response, 500, {
      ok: false,
      error: 'APPS_SCRIPT_URL is not a valid URL.',
    });
    return;
  }

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  if (appsScriptToken) {
    targetUrl.searchParams.set('token', appsScriptToken);
  }

  try {
    const body = request.method === 'POST' ? await readRequestBody(request) : undefined;
    const upstream = await fetch(targetUrl.toString(), {
      method: request.method || 'GET',
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
    response.writeHead(upstream.status || 502, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(upstreamBody);
  } catch (error) {
    sendJson(response, 502, {
      ok: false,
      error: `Failed to reach Apps Script backend: ${error.message}`,
    });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || `localhost:${PORT}`}`);

    if (requestUrl.pathname === API_PATH) {
      await proxyAppsScript(request, response);
      return;
    }

    const filePath = safeResolve(request.url || '/');
    if (!filePath) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Bad request');
      return;
    }

    fs.stat(filePath, (error, stats) => {
      if (!error && stats.isFile()) {
        sendFile(filePath, response);
        return;
      }

      if (!error && stats.isDirectory()) {
        sendFile(path.join(filePath, 'index.html'), response);
        return;
      }

      if (!path.extname(filePath)) {
        sendFile(path.join(ROOT_DIR, 'index.html'), response);
        return;
      }

      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error.message || 'Internal server error.',
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`RS matching board is running at http://localhost:${PORT}`);
});
