import express from 'express';
import request from 'supertest';
import { requestLogger } from '../../../../src/infrastructure/http/middleware/request-logger';
import type { LogEntry, Logger } from '../../../../src/domain/ports/logger';

function recordingLogger() {
  const entries: LogEntry[] = [];
  const record = (entry: LogEntry) => {
    entries.push(entry);
  };
  const logger: Logger = { info: record, warn: record, error: record };
  return { logger, entries };
}

function appWith(logger: Logger) {
  const app = express();
  app.use(requestLogger(logger));
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/api/thing', (_req, res) => {
    res.status(201).json({ ok: true });
  });
  app.get('/api/boom', (_req, res) => {
    res.status(500).json({ error: true });
  });
  return app;
}

describe('requestLogger', () => {
  it('emits start-request and end-request sharing one IdTransaction', async () => {
    const { logger, entries } = recordingLogger();
    await request(appWith(logger)).get('/api/thing');

    expect(entries.map((e) => e.action)).toEqual(['start-request', 'end-request']);
    expect(entries[0]?.IdTransaction).toBeDefined();
    expect(entries[1]?.IdTransaction).toBe(entries[0]?.IdTransaction);
  });

  it('reports the response status and a measured responseTime on end-request', async () => {
    const { logger, entries } = recordingLogger();
    await request(appWith(logger)).get('/api/thing');

    const end = entries[1];
    expect(end?.status).toBe(201);
    expect(end?.method).toBe('GET');
    expect(end?.event).toBe('GET /api/thing');
    expect(typeof end?.responseTime).toBe('number');
    expect(end?.responseTime).toBeGreaterThanOrEqual(0);
  });

  it('gives each request its own IdTransaction', async () => {
    const { logger, entries } = recordingLogger();
    const app = appWith(logger);
    await request(app).get('/api/thing');
    await request(app).get('/api/thing');

    expect(entries[0]?.IdTransaction).not.toBe(entries[2]?.IdTransaction);
  });

  it('does not log health checks', async () => {
    const { logger, entries } = recordingLogger();
    await request(appWith(logger)).get('/api/health');

    expect(entries).toHaveLength(0);
  });

  it('still emits end-request when the handler answers 5xx', async () => {
    const { logger, entries } = recordingLogger();
    await request(appWith(logger)).get('/api/boom');

    expect(entries[1]?.status).toBe(500);
  });
});
