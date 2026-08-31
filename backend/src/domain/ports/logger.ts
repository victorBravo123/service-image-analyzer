export type LogAction = 'startup' | 'start-request' | 'end-request' | 'error';

export interface LogEntry {
  readonly message: string;
  readonly action?: LogAction | undefined;
  readonly IdTransaction?: string | undefined;
  readonly urlService?: string | undefined;
  readonly event?: string | undefined;
  readonly method?: string | undefined;
  readonly responseTime?: number | undefined;
  readonly status?: number | string | undefined;
  readonly code?: string | undefined;
}

export interface Logger {
  info(entry: LogEntry): void;
  warn(entry: LogEntry): void;
  error(entry: LogEntry): void;
}
