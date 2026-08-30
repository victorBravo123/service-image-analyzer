import { PinoLogger } from '../../../../src/infrastructure/config/logging/pino.logger';
import type { Logger as PinoBaseLogger } from 'pino';

type Emitted = Record<string, unknown>;

function fakePino() {
  const info = jest.fn<void, [Emitted]>();
  const warn = jest.fn<void, [Emitted]>();
  const error = jest.fn<void, [Emitted]>();
  return { info, warn, error, asPino: { info, warn, error } as unknown as PinoBaseLogger };
}

const config = { level: 'info' as const, serviceName: 'svc', version: '1.0.0' };

describe('PinoLogger', () => {
  it('forwards every field of the entry to pino', () => {
    const pino = fakePino();
    new PinoLogger(config, pino.asPino).info({
      IdTransaction: 'abc',
      urlService: '/api/analyze',
      action: 'start-request',
      event: 'POST /api/analyze',
      method: 'POST',
      responseTime: 0,
      status: 'ok',
      code: '0',
      message: 'No request data',
    });

    expect(pino.info).toHaveBeenCalledTimes(1);
    expect(pino.info.mock.calls[0]?.[0]).toMatchObject({
      IdTransaction: 'abc',
      urlService: '/api/analyze',
      action: 'start-request',
      event: 'POST /api/analyze',
      method: 'POST',
      status: 'ok',
      code: '0',
      message: 'No request data',
    });
  });

  it('stamps an ISO datetime on every entry', () => {
    const pino = fakePino();
    new PinoLogger(config, pino.asPino).info({ message: 'hello' });

    expect(pino.info.mock.calls[0]?.[0]['datetime']).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('routes each level to its pino counterpart', () => {
    const pino = fakePino();
    const logger = new PinoLogger(config, pino.asPino);

    logger.warn({ message: 'careful' });
    logger.error({ message: 'broken' });

    expect(pino.warn).toHaveBeenCalledTimes(1);
    expect(pino.error).toHaveBeenCalledTimes(1);
    expect(pino.info).not.toHaveBeenCalled();
  });
});
