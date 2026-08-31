import type { LogLevel } from '../../envs/env';

export interface LoggerConfig {
  readonly level: LogLevel;
  readonly serviceName: string;
  readonly version: string;
}
