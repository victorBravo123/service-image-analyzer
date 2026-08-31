import type { Tag } from './tag';

export class ImageAnalysis {
  private constructor(readonly tags: readonly Tag[]) {}

  static fromTags(tags: readonly Tag[]): ImageAnalysis {
    const ranked = [...tags].sort((a, b) => b.confidence - a.confidence);
    return new ImageAnalysis(ranked);
  }
}
