import { DomainError } from './domain.error';

export class AnnotatorMisconfiguredError extends DomainError {
  readonly code = 'ANALYSIS_FAILED';

  constructor(reason: string) {
    super(`Image analysis failed: ${reason}`);
  }
}
