import type { Logger } from 'pino';
import type { AnalyzeImageUseCase } from '../../../application/use-cases/analyze-image/analyze-image.use-case';

export interface ServerDependencies {
  analyzeImage: AnalyzeImageUseCase;
  maxImageBytes: number;
  logger: Logger;
}
