import type { Logger } from '../../../domain/ports/logger';
import type { AnalyzeImageUseCase } from '../../../application/use-cases/analyze-image/analyze-image.use-case';

export interface ServerDependencies {
  analyzeImage: AnalyzeImageUseCase;
  maxImageBytes: number;
  logger: Logger;
}
