import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { QUEUE_NAMES } from 'selfless-sdk';
import { logger } from './logger';

const WATCHED_QUEUES = Object.values(QUEUE_NAMES);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function startHealthServer(workerCount: number): void {
  const port = Number(process.env.PORT) || 3001;
  const startedAt = new Date().toISOString();

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';

    if (req.method === 'GET' && (url === '/' || url === '/health')) {
      sendJson(res, 200, {
        status: 'ok',
        service: 'selfless-worker',
        version: process.env.npm_package_version ?? '1.0.0',
        workers: workerCount,
        queues: WATCHED_QUEUES,
        uptime_seconds: Math.floor(process.uptime()),
        started_at: startedAt,
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV ?? 'development',
      });
      return;
    }

    if (req.method === 'GET' && url === '/ping') {
      sendJson(res, 200, { pong: true });
      return;
    }

    sendJson(res, 404, { error: 'Not Found' });
  });

  server.listen(port, () => {
    logger.info(`Health server → http://0.0.0.0:${port}/health`);
  });
}
