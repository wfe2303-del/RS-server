const http = require('http');
const https = require('https');
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
    'Cache-Control': 'no-cache',
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

function requestWithRedirects(targetUrl, remainingRedirects = 5) {
  return new Promise((resolve, reject) => {
    const client = targetUrl.protocol === 'http:' ? http : https;
    const proxyRequest = client.request(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    }, (proxyResponse) => {
      const statusCode = proxyResponse.statusCode || 502;
      const location = proxyResponse.headers.location;

      if (location && [301, 302, 303, 307, 308].includes(statusCode)) {
        proxyResponse.resume();

        if (remainingRedirects <= 0) {
          reject(new Error('Apps Script redirect limit exceeded.'));
          return;
        }

        const redirectedUrl = new URL(location, targetUrl);
        requestWithRedirects(redirectedUrl, remainingRedirects - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      let body = '';
      proxyResponse.setEncoding('utf8');
      proxyResponse.on('data', (chunk) => {
        body += chunk;
      });
      proxyResponse.on('end', () => {
        resolve({
          statusCode,
          headers: proxyResponse.headers,
          body,
        });
      });
    });

    proxyRequest.on('error', reject);
    proxyRequest.end();
  });
}

async function proxyAppsScript(request, response) {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  const appsScriptToken = process.env.APPS_SCRIPT_TOKEN || '';
  const mockFile = process.env.MOCK_SETTLEMENTS_FILE || '';
  const incomingUrl = new URL(request.url || API_PATH, `http://${request.headers.host || `localhost:${PORT}`}`);

  if (!appsScriptUrl && mockFile) {
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
        error: `MOCK_SETTLEMENTS_FILE 처리에 실패했습니다: ${error.message}`,
      });
    }
    return;
  }

  if (!appsScriptUrl) {
    sendJson(response, 500, {
      ok: false,
      error: 'APPS_SCRIPT_URL 환경변수가 설정되지 않았습니다.',
    });
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(appsScriptUrl);
  } catch {
    sendJson(response, 500, {
      ok: false,
      error: 'APPS_SCRIPT_URL 값이 올바른 URL이 아닙니다.',
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
    const proxyResponse = await requestWithRedirects(targetUrl);
    response.writeHead(proxyResponse.statusCode || 502, {
      'Content-Type': proxyResponse.headers['content-type'] || 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    response.end(proxyResponse.body);
  } catch (error) {
    sendJson(response, 502, {
      ok: false,
      error: `Apps Script 프록시 요청에 실패했습니다: ${error.message}`,
    });
  }
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || `localhost:${PORT}`}`);

  if (requestUrl.pathname === API_PATH) {
    proxyAppsScript(request, response);
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
});

server.listen(PORT, HOST, () => {
  console.log(`RS matching board is running at http://localhost:${PORT}`);
});
