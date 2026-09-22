import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

export async function startMockReceiver({ port = 19099, logPath }) {
  if (!logPath) throw new Error('logPath is required');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, '');
  const attempts = new Map();

  const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200).end('ok');
      return;
    }
    if (request.method !== 'POST' || !request.url) {
      response.writeHead(404).end();
      return;
    }

    const rawBody = await readBody(request);
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = { rawBody };
    }
    const key = `${request.url}|${body.eventType ?? 'unknown'}|${body.id ?? ''}`;
    const attempt = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, attempt);
    fs.appendFileSync(
      logPath,
      `${JSON.stringify({
        path: request.url,
        attempt,
        headers: request.headers,
        body,
        receivedAt: Date.now(),
      })}\n`
    );

    if (request.url.startsWith('/client-error/')) {
      response.writeHead(422).end();
    } else if (request.url.startsWith('/retry/') && attempt < 3) {
      response.writeHead(503).end();
    } else {
      response.writeHead(204).end();
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Receiver did not bind a TCP port');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const receiver = await startMockReceiver({
    port: Number(argument('--port', '19099')),
    logPath: path.resolve(argument('--log', '.e2e-artifacts/forwarding.jsonl')),
  });
  console.log(`Mock receiver ready at ${receiver.url}`);
  const stop = async () => {
    await receiver.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
