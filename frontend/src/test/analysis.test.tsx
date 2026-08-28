import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { App } from '../ui/App';
import { ApiError } from '../infrastructure/api/analyze-client';

vi.mock('../infrastructure/api/analyze-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../infrastructure/api/analyze-client')>();
  return { ...original, analyzeImage: vi.fn() };
});

const { analyzeImage } = await import('../infrastructure/api/analyze-client');
const analyzeImageMock = vi.mocked(analyzeImage);

function pngFile(name = 'dog.png'): File {
  const file = new File([new Uint8Array(8)], name, { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: 1024 });
  return file;
}

async function selectImage() {
  await userEvent.upload(screen.getByTestId('file-input') as HTMLInputElement, pngFile());
}

describe('image analysis flow', () => {
  beforeEach(() => {
    analyzeImageMock.mockReset();
  });

  it('keeps the analyze button disabled until an image is selected', async () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Analizar' })).toBeDisabled();

    await selectImage();

    expect(screen.getByRole('button', { name: 'Analizar' })).toBeEnabled();
  });

  it('shows the spinner while analyzing and then the ranked tags', async () => {
    let resolveAnalysis!: (value: { tags: { label: string; confidence: number }[] }) => void;
    analyzeImageMock.mockImplementation(
      () => new Promise((resolve) => (resolveAnalysis = resolve)),
    );
    render(<App />);
    await selectImage();

    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

    expect(screen.getByRole('status')).toHaveTextContent(/Analizando/);

    resolveAnalysis({
      tags: [
        { label: 'perro', confidence: 0.98 },
        { label: 'parque', confidence: 0.91 },
      ],
    });

    expect(await screen.findByText('perro')).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText('parque')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('explains a provider failure in plain language', async () => {
    analyzeImageMock.mockRejectedValue(new ApiError('ANALYSIS_FAILED', 'upstream error'));
    render(<App />);
    await selectImage();

    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudo analizar la imagen/);
  });

  it('tells the user when the backend cannot be reached', async () => {
    analyzeImageMock.mockRejectedValue(new ApiError('NETWORK_ERROR', 'offline'));
    render(<App />);
    await selectImage();

    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo conectar con el servidor/);
  });

  it('shows an empty state when the AI recognizes nothing', async () => {
    analyzeImageMock.mockResolvedValue({ tags: [] });
    render(<App />);
    await selectImage();

    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

    expect(await screen.findByText(/no reconoció contenido/)).toBeInTheDocument();
  });
});
