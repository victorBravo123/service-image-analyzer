import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../ui/App';

function imageFile(name: string, type = 'image/png', sizeBytes = 1024): File {
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

async function selectFile(file: File) {
  await userEvent.upload(screen.getByTestId('file-input') as HTMLInputElement, file);
}

describe('image uploader', () => {
  it('invites the user to pick an image when nothing is selected', () => {
    render(<App />);

    expect(screen.getByText(/Haz clic para elegir una imagen/)).toBeInTheDocument();
  });

  it('previews the selected image', async () => {
    render(<App />);

    await selectFile(imageFile('dog.png'));

    expect(screen.getByAltText(/dog\.png/)).toBeInTheDocument();
    expect(screen.getByText('dog.png')).toBeInTheDocument();
  });

  // The file picker filters by the input's accept attribute, so a non-image can
  // only reach the app by drag & drop — which is exactly what this covers.
  it('rejects a dropped file that is not an image', () => {
    render(<App />);

    fireEvent.drop(screen.getByLabelText('Seleccionar imagen para analizar'), {
      dataTransfer: { files: [imageFile('notes.txt', 'text/plain')] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/no es una imagen/);
    expect(screen.queryByAltText(/notes\.txt/)).not.toBeInTheDocument();
  });

  it('rejects a file over the 5 MB limit', async () => {
    render(<App />);

    await selectFile(imageFile('huge.png', 'image/png', 6 * 1024 * 1024));

    expect(screen.getByRole('alert')).toHaveTextContent(/supera el máximo de 5 MB/);
    expect(screen.queryByAltText(/huge\.png/)).not.toBeInTheDocument();
  });
});
