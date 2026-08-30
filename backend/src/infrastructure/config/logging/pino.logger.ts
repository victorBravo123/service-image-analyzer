import { pino } from 'pino';
import type { Logger as PinoBaseLogger } from 'pino';
import type { LogEntry, Logger } from '../../../domain/ports/logger';
import type { LoggerConfig } from './dto/logger.config';

export class PinoLogger implements Logger {
  constructor(
    config: LoggerConfig,
    private readonly logger: PinoBaseLogger = pino({
      level: config.level,
      base: { serviceName: config.serviceName, version: config.version },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
    }),
  ) {}

  info(entry: LogEntry): void {
    this.logger.info(decorate(entry));
  }

  warn(entry: LogEntry): void {
    this.logger.warn(decorate(entry));
  }

  error(entry: LogEntry): void {
    this.logger.error(decorate(entry));
  }
}

function decorate(entry: LogEntry): Record<string, unknown> {
  return { datetime: new Date().toISOString(), ...entry };
}
