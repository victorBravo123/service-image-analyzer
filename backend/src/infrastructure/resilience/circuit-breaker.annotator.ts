import { AnnotatorUnavailableError } from '../../domain/errors/annotator-unavailable.error';
import { AnnotatorMisconfiguredError } from '../../domain/errors/annotator-misconfigured.error';
import { DomainError } from '../../domain/errors/domain.error';
import type { Tag } from '../../domain/model/tag';
import type { CircuitBreakerStore } from '../../domain/ports/circuit-breaker.store';
import type { ImageAnnotator, ImageToAnnotate } from '../../domain/ports/image-annotator';
import type { Logger } from '../../domain/ports/logger';

const PROVIDER_FAILURES: ReadonlySet<string> = new Set(['ANALYSIS_FAILED', 'SERVICE_UNAVAILABLE']);

const UNAVAILABLE_MESSAGE = 'image analysis is temporarily unavailable';

export class CircuitBreakerAnnotator implements ImageAnnotator {
  constructor(
    private readonly inner: ImageAnnotator,
    private readonly circuit: CircuitBreakerStore,
    private readonly logger: Logger,
  ) {}

  async annotate(image: ImageToAnnotate): Promise<Tag[]> {
    await this.ensureClosed();

    try {
      const tags = await this.inner.annotate(image);
      await this.recordOutcome(() => this.circuit.recordSuccess());
      return tags;
    } catch (error) {
      if (countsAsProviderFailure(error)) {
        await this.recordOutcome(async () => {
          const failures = await this.circuit.recordFailure();
          this.logger.error({
            action: 'error',
            code: 'PROVIDER_FAILURE',
            message: `image provider failed (${String(failures)} in a row): ${error.message}`,
          });
        });
      }
      throw error;
    }
  }

  private async ensureClosed(): Promise<void> {
    let open: boolean;
    try {
      open = await this.circuit.isOpen();
    } catch (error) {
      this.logStoreFailure('reading the circuit state', error);
      throw new AnnotatorUnavailableError(UNAVAILABLE_MESSAGE);
    }

    if (open) {
      this.logger.warn({
        action: 'error',
        code: 'CIRCUIT_OPEN',
        status: 503,
        message: 'circuit is open, skipping the image provider',
      });
      throw new AnnotatorUnavailableError(UNAVAILABLE_MESSAGE);
    }
  }

  private async recordOutcome(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.logStoreFailure('recording the call outcome', error);
    }
  }

  private logStoreFailure(operation: string, error: unknown): void {
    this.logger.error({
      action: 'error',
      code: 'CIRCUIT_STORE_UNAVAILABLE',
      status: 503,
      message: `circuit breaker store failed while ${operation}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    });
  }
}

function countsAsProviderFailure(error: unknown): error is DomainError {
  if (error instanceof AnnotatorMisconfiguredError) {
    return false;
  }
  return error instanceof DomainError && PROVIDER_FAILURES.has(error.code);
}
