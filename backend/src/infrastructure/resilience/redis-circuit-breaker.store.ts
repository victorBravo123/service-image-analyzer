import type { Redis } from 'ioredis';
import type { CircuitBreakerStore } from '../../domain/ports/circuit-breaker.store';

export class RedisCircuitBreakerStore implements CircuitBreakerStore {
  constructor(
    private readonly redis: Redis,
    private readonly threshold: number,
    private readonly openMs: number,
    private readonly name = 'imagga',
  ) {}

  async isOpen(): Promise<boolean> {
    return (await this.redis.exists(this.key('open'))) === 1;
  }

  async recordFailure(): Promise<number> {
    const failures = await this.redis.incr(this.key('failures'));
    if (failures >= this.threshold) {
      await this.redis.set(this.key('open'), '1', 'PX', this.openMs);
    }
    return failures;
  }

  async recordSuccess(): Promise<void> {
    await this.redis.del(this.key('failures'), this.key('open'));
  }

  private key(suffix: string): string {
    return `circuit:${this.name}:${suffix}`;
  }
}
