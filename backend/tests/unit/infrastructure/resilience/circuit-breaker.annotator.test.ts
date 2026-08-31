import { CircuitBreakerAnnotator } from '../../../../src/infrastructure/resilience/circuit-breaker.annotator';
import { AnalysisFailedError } from '../../../../src/domain/errors/analysis-failed.error';
import { AnnotatorUnavailableError } from '../../../../src/domain/errors/annotator-unavailable.error';
import { UnsupportedImageFormatError } from '../../../../src/domain/errors/unsupported-image-format.error';
import { AnnotatorMisconfiguredError } from '../../../../src/domain/errors/annotator-misconfigured.error';
import { Tag } from '../../../../src/domain/model/tag';
import type { CircuitBreakerStore } from '../../../../src/domain/ports/circuit-breaker.store';
import type { ImageAnnotator, ImageToAnnotate } from '../../../../src/domain/ports/image-annotator';
import type { Logger } from '../../../../src/domain/ports/logger';

const IMAGE: ImageToAnnotate = { content: Buffer.from([0xff, 0xd8]), format: 'jpeg' };

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** Minimal double: counts failures and opens at the threshold, like Redis does. */
function fakeCircuit(threshold = 3) {
  let failures = 0;
  let open = false;
  const store: CircuitBreakerStore = {
    isOpen: () => Promise.resolve(open),
    recordFailure: () => {
      failures += 1;
      if (failures >= threshold) open = true;
      return Promise.resolve(failures);
    },
    recordSuccess: () => {
      failures = 0;
      open = false;
      return Promise.resolve();
    },
  };
  return { store, isOpen: () => open, failures: () => failures };
}

const working: ImageAnnotator = { annotate: () => Promise.resolve([Tag.create('dog', 0.9)]) };

describe('CircuitBreakerAnnotator', () => {
  it('passes the call through while the circuit is closed', async () => {
    const circuit = fakeCircuit();
    const breaker = new CircuitBreakerAnnotator(working, circuit.store, silentLogger);

    await expect(breaker.annotate(IMAGE)).resolves.toHaveLength(1);
  });

  it('opens after three provider failures', async () => {
    const circuit = fakeCircuit();
    const annotate = jest.fn(() => Promise.reject(new AnalysisFailedError('provider down')));
    const breaker = new CircuitBreakerAnnotator({ annotate }, circuit.store, silentLogger);

    for (let i = 0; i < 3; i += 1) {
      await expect(breaker.annotate(IMAGE)).rejects.toThrow(AnalysisFailedError);
    }
    expect(circuit.isOpen()).toBe(true);

    // The fourth call never reaches the provider.
    await expect(breaker.annotate(IMAGE)).rejects.toThrow(AnnotatorUnavailableError);
    expect(annotate).toHaveBeenCalledTimes(3);
  });

  it('closes again and forgets the failures after a success', async () => {
    const circuit = fakeCircuit();
    let healthy = false;
    const inner: ImageAnnotator = {
      annotate: () =>
        healthy
          ? Promise.resolve([Tag.create('dog', 0.9)])
          : Promise.reject(new AnalysisFailedError('provider down')),
    };
    const breaker = new CircuitBreakerAnnotator(inner, circuit.store, silentLogger);

    await expect(breaker.annotate(IMAGE)).rejects.toThrow(AnalysisFailedError);
    await expect(breaker.annotate(IMAGE)).rejects.toThrow(AnalysisFailedError);
    expect(circuit.failures()).toBe(2);

    healthy = true;
    await expect(breaker.annotate(IMAGE)).resolves.toHaveLength(1);
    expect(circuit.failures()).toBe(0);
  });

  it('does not count a rejected image as a provider failure', async () => {
    const circuit = fakeCircuit();
    const inner: ImageAnnotator = {
      annotate: () => Promise.reject(new UnsupportedImageFormatError()),
    };
    const breaker = new CircuitBreakerAnnotator(inner, circuit.store, silentLogger);

    await expect(breaker.annotate(IMAGE)).rejects.toThrow(UnsupportedImageFormatError);
    expect(circuit.failures()).toBe(0);
  });

  it('does not open the circuit when the provider rejects our credentials', async () => {
    const circuit = fakeCircuit();
    const inner: ImageAnnotator = {
      annotate: () => Promise.reject(new AnnotatorMisconfiguredError('bad key')),
    };
    const breaker = new CircuitBreakerAnnotator(inner, circuit.store, silentLogger);

    for (let i = 0; i < 5; i += 1) {
      await expect(breaker.annotate(IMAGE)).rejects.toThrow(AnnotatorMisconfiguredError);
    }
    expect(circuit.isOpen()).toBe(false);
    expect(circuit.failures()).toBe(0);
  });

  it('reports 503 instead of a 500 when the store cannot be read', async () => {
    const broken: CircuitBreakerStore = {
      isOpen: () => Promise.reject(new Error('ECONNREFUSED')),
      recordFailure: () => Promise.resolve(1),
      recordSuccess: () => Promise.resolve(),
    };
    const annotate = jest.fn(() => Promise.resolve([Tag.create('dog', 0.9)]));
    const breaker = new CircuitBreakerAnnotator({ annotate }, broken, silentLogger);

    await expect(breaker.annotate(IMAGE)).rejects.toThrow(AnnotatorUnavailableError);
    expect(annotate).not.toHaveBeenCalled();
  });

  it('still returns the tags when the store fails after a successful call', async () => {
    const broken: CircuitBreakerStore = {
      isOpen: () => Promise.resolve(false),
      recordFailure: () => Promise.resolve(1),
      recordSuccess: () => Promise.reject(new Error('ECONNREFUSED')),
    };
    const breaker = new CircuitBreakerAnnotator(working, broken, silentLogger);

    await expect(breaker.annotate(IMAGE)).resolves.toHaveLength(1);
  });

  it('keeps the provider error when the store fails while recording it', async () => {
    const broken: CircuitBreakerStore = {
      isOpen: () => Promise.resolve(false),
      recordFailure: () => Promise.reject(new Error('ECONNREFUSED')),
      recordSuccess: () => Promise.resolve(),
    };
    const inner: ImageAnnotator = {
      annotate: () => Promise.reject(new AnalysisFailedError('provider down')),
    };
    const breaker = new CircuitBreakerAnnotator(inner, broken, silentLogger);

    await expect(breaker.annotate(IMAGE)).rejects.toThrow(AnalysisFailedError);
  });
});
