import { Tag } from '../../domain/model/tag';
import { AnalysisFailedError } from '../../domain/errors/analysis-failed.error';
import { AnnotatorUnavailableError } from '../../domain/errors/annotator-unavailable.error';
import { AnnotatorMisconfiguredError } from '../../domain/errors/annotator-misconfigured.error';
import type { ImageAnnotator, ImageToAnnotate } from '../../domain/ports/image-annotator';
import type { ImaggaConfig } from './dto/imagga.config';
import { imaggaTagsResponseSchema } from './dto/imagga-tags.response';
import type { ImaggaTag } from './dto/imagga-tags.response';

const DEFAULT_MAX_TAGS = 10;

export class ImaggaAnnotator implements ImageAnnotator {
  constructor(private readonly config: ImaggaConfig) {}

  async annotate(image: ImageToAnnotate): Promise<Tag[]> {
    const response = await this.requestTags(image);
    return toDomainTags(await extractTags(response));
  }

  private async requestTags(image: ImageToAnnotate): Promise<Response> {
    const maxTags = this.config.maxTags ?? DEFAULT_MAX_TAGS;

    const body = new FormData();
    const blob = new Blob([new Uint8Array(image.content)], { type: `image/${image.format}` });
    body.append('image', blob, `upload.${image.format}`);

    try {
      return await fetch(`${this.config.baseUrl}/tags?limit=${maxTags}`, {
        method: 'POST',
        headers: { Authorization: this.authorizationHeader() },
        body,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      if (isTimeout(error)) {
        throw new AnalysisFailedError(`provider did not respond within ${this.config.timeoutMs}ms`);
      }
      throw new AnalysisFailedError('could not reach the image analysis provider');
    }
  }

  private authorizationHeader(): string {
    const credentials = `${this.config.apiKey}:${this.config.apiSecret}`;
    return `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`;
  }
}

async function extractTags(response: Response): Promise<ImaggaTag[]> {
  if (response.status === 429) {
    throw new AnnotatorUnavailableError('provider rate limit exceeded');
  }
  if (response.status === 401 || response.status === 403) {
    throw new AnnotatorMisconfiguredError(
      `provider rejected our credentials (HTTP ${String(response.status)}) — ` +
        'check IMAGGA_API_KEY and IMAGGA_API_SECRET',
    );
  }
  if (!response.ok) {
    throw new AnalysisFailedError(`provider responded with HTTP ${response.status}`);
  }

  const parsed = imaggaTagsResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new AnalysisFailedError('provider returned an unexpected payload');
  }

  const { status, result } = parsed.data;
  if (status.type !== 'success') {
    throw new AnalysisFailedError(`provider reported "${status.text ?? status.type}"`);
  }
  return result?.tags ?? [];
}

function toDomainTags(rawTags: ImaggaTag[]): Tag[] {
  return rawTags
    .filter((raw) => typeof raw.tag?.en === 'string' && raw.tag.en.trim().length > 0)
    .map((raw) => Tag.create(raw.tag?.en ?? '', normalizeConfidence(raw.confidence ?? 0)));
}

/** Imagga reports confidence as 0-100; the domain works in [0, 1]. */
function normalizeConfidence(value: number): number {
  return Math.min(1, Math.max(0, value / 100));
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AnalysisFailedError('provider returned a body that is not JSON');
  }
}
