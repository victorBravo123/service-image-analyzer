export interface CircuitBreakerStore {
  isOpen(): Promise<boolean>;

  recordFailure(): Promise<number>;

  recordSuccess(): Promise<void>;
}
