import type { ImageFormat } from '../model/image-format';
import type { Tag } from '../model/tag';

export interface ImageToAnnotate {
  readonly content: Buffer;
  readonly format: ImageFormat;
}

export interface ImageAnnotator {
  annotate(image: ImageToAnnotate): Promise<Tag[]>;
}
