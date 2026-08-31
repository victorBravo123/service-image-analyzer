import { DomainError } from './domain.error';
import { SUPPORTED_IMAGE_FORMATS } from '../model/image-format';

export class UnsupportedImageFormatError extends DomainError {
  readonly code = 'UNSUPPORTED_MEDIA_TYPE';

  constructor() {
    super(`File content is not a supported image format (${SUPPORTED_IMAGE_FORMATS.join(', ')})`);
  }
}
