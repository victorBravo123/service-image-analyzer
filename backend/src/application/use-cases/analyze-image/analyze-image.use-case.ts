import { ImageAnalysis } from '../../../domain/model/image-analysis';
import { detectImageFormat } from '../../../domain/model/image-format';
import { UnsupportedImageFormatError } from '../../../domain/errors/unsupported-image-format.error';
import type { ImageAnnotator } from '../../../domain/ports/image-annotator';
import type { AnalyzeImageCommand } from './analyze-image.command';

export class AnalyzeImageUseCase {
  constructor(private readonly annotator: ImageAnnotator) {}

  async execute(command: AnalyzeImageCommand): Promise<ImageAnalysis> {
    const format = detectImageFormat(command.content);
    if (format === null) {
      throw new UnsupportedImageFormatError();
    }

    const tags = await this.annotator.annotate({ content: command.content, format });
    return ImageAnalysis.fromTags(tags);
  }
}
