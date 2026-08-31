import { Redis } from 'ioredis';
import { RedisCircuitBreakerStore } from '../../src/infrastructure/resilience/redis-circuit-breaker.store';

const url = process.env.REDIS_TEST_URL;
const describeRedis = url ? describe : describe.skip;

describeRedis('RedisCircuitBreakerStore', () => {
  let redis: Redis;
  let store: RedisCircuitBreakerStore;

  beforeAll(() => {
    redis = new Redis(url ?? '');
    store = new RedisCircuitBreakerStore(redis, 3, 500, 'test');
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('starts closed', async () => {
    await expect(store.isOpen()).resolves.toBe(false);
  });

  it('stays closed below the threshold and opens on the third failure', async () => {
    await expect(store.recordFailure()).resolves.toBe(1);
    await expect(store.isOpen()).resolves.toBe(false);

    await expect(store.recordFailure()).resolves.toBe(2);
    await expect(store.isOpen()).resolves.toBe(false);

    await expect(store.recordFailure()).resolves.toBe(3);
    await expect(store.isOpen()).resolves.toBe(true);
  });

  it('closes on its own once the open key expires', async () => {
    await store.recordFailure();
    await store.recordFailure();
    await store.recordFailure();

    await new Promise((resolve) => setTimeout(resolve, 600));
    await expect(store.isOpen()).resolves.toBe(false);
  });

  it('closes and resets the counter on success', async () => {
    await store.recordFailure();
    await store.recordFailure();
    await store.recordFailure();

    await store.recordSuccess();

    await expect(store.isOpen()).resolves.toBe(false);
    await expect(store.recordFailure()).resolves.toBe(1);
  });

  it('counts concurrent failures exactly', async () => {
    await Promise.all(Array.from({ length: 50 }, () => store.recordFailure()));

    await expect(redis.get('circuit:test:failures')).resolves.toBe('50');
  });

  it('shares state across instances', async () => {
    const secondConnection = new Redis(url ?? '');
    const other = new RedisCircuitBreakerStore(secondConnection, 3, 500, 'test');

    try {
      await store.recordFailure();
      await store.recordFailure();
      await other.recordFailure();

      await expect(store.isOpen()).resolves.toBe(true);
      await expect(other.isOpen()).resolves.toBe(true);
    } finally {
      await secondConnection.quit();
    }
  });
});
