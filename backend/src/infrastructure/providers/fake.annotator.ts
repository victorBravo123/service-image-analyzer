import type { ImageAnnotator, ImageToAnnotate } from '../../domain/ports/image-annotator';
import { Tag } from '../../domain/model/tag';

export class FakeAnnotator implements ImageAnnotator {
  annotate(image: ImageToAnnotate): Promise<Tag[]> {
    return Promise.resolve([
      Tag.create('Demo tag', 0.99),
      Tag.create(`Format ${image.format}`, 0.9),
      Tag.create(`Size ${image.content.length} bytes`, 0.75),
    ]);
  }
}
