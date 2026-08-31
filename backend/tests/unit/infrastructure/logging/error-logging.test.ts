import request from 'supertest';
import { buildApp } from '../../../../src/infrastructure/http/server';
import { AnalyzeImageUseCase } from '../../../../src/application/use-cases/analyze-image/analyze-image.use-case';
import { AnalysisFailedError } from '../../../../src/domain/errors/analysis-failed.error';
import type { ImageAnnotator } from '../../../../src/domain/ports/image-annotator';
import type { LogEntry, Logger } from '../../../../src/domain/ports/logger';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function recordingLogger() {
  const warned: LogEntry[] = [];
  const errored: LogEntry[] = [];
  const logger: Logger = {
    info: () => undefined,
    warn: (e) => warned.push(e),
    error: (e) => errored.push(e),
  };
  return { logger, warned, errored };
}

function appWith(logger: Logger, annotator: ImageAnnotator) {
  return buildApp({
    analyzeImage: new AnalyzeImageUseCase(annotator),
    maxImageBytes: 1024 * 1024,
    logger,
  });
}

const failing: ImageAnnotator = {
  annotate: () => Promise.reject(new AnalysisFailedError('provider exploded')),
};

describe('error logging', () => {
  it('logs a provider failure at error level with the domain code', async () => {
    const { logger, errored } = recordingLogger();
    await request(appWith(logger, failing)).post('/api/analyze').attach('image', PNG, 'a.png');

    expect(errored).toHaveLength(1);
    expect(errored[0]).toMatchObject({
      action: 'error',
      code: 'ANALYSIS_FAILED',
      status: 502,
      method: 'POST',
      urlService: '/api/analyze',
    });
    expect(errored[0]?.message).toContain('provider exploded');
  });

  it('logs a rejected upload at warn level, not error', async () => {
    const { logger, warned, errored } = recordingLogger();
    await request(appWith(logger, failing))
      .post('/api/analyze')
      .attach('image', Buffer.from('not an image'), 'a.txt');

    expect(errored).toHaveLength(0);
    expect(warned).toHaveLength(1);
    expect(warned[0]).toMatchObject({
      action: 'error',
      code: 'UNSUPPORTED_MEDIA_TYPE',
      status: 415,
    });
  });

  it('correlates the failure with the request that caused it', async () => {
    const entries: LogEntry[] = [];
    const push = (e: LogEntry) => entries.push(e);
    const logger: Logger = { info: push, warn: push, error: push };

    await request(appWith(logger, failing)).post('/api/analyze').attach('image', PNG, 'a.png');

    const start = entries.find((e) => e.action === 'start-request');
    const failure = entries.find((e) => e.action === 'error');
    expect(failure?.IdTransaction).toBe(start?.IdTransaction);
    expect(failure?.responseTime).toBeGreaterThanOrEqual(0);
  });
});
