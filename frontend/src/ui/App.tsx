import { useImageSelection } from '../application/useImageSelection';
import type { ImageValidationError } from '../domain/image-validation';
import { ImageDropzone } from './components/ImageDropzone';
import { ErrorBanner } from './components/ErrorBanner';

const VALIDATION_MESSAGES: Record<ImageValidationError, string> = {
  NOT_AN_IMAGE: 'El archivo seleccionado no es una imagen. Usa JPG, PNG, WebP o GIF.',
  TOO_LARGE: 'La imagen supera el máximo de 5 MB. Elige un archivo más liviano.',
};

export function App() {
  const selection = useImageSelection();

  return (
    <div className="page">
      <header className="page__header">
        <h1>Analizador de Imágenes</h1>
        <p>Sube una imagen y descubre qué contiene usando inteligencia artificial.</p>
      </header>

      <main className="card">
        <ImageDropzone
          previewUrl={selection.previewUrl}
          fileName={selection.file?.name ?? null}
          disabled={false}
          onSelect={selection.select}
        />

        {selection.validationError && (
          <ErrorBanner message={VALIDATION_MESSAGES[selection.validationError]} />
        )}
      </main>
    </div>
  );
}
