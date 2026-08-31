export const MAX_IMAGE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

export type ImageValidationError = 'NOT_AN_IMAGE' | 'TOO_LARGE';

export function validateImageFile(file: File): ImageValidationError | null {
  if (!file.type.startsWith('image/')) {
    return 'NOT_AN_IMAGE';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'TOO_LARGE';
  }
  return null;
}
