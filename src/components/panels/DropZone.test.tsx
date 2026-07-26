import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import DropZone from './DropZone';

describe('DropZone', () => {
  it('renders the default prompt', () => {
    render(
      <DropZone accept={{ 'image/*': ['.png'] }} onFileAccepted={() => {}} />
    );
    expect(screen.getByText('ファイル選択')).toBeInTheDocument();
  });

  it('calls onFileAccepted with the selected file', async () => {
    const onFileAccepted = vi.fn();
    const { container } = render(
      <DropZone
        accept={{ 'image/*': ['.png'] }}
        onFileAccepted={onFileAccepted}
      />
    );
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    const file = new File(['dummy'], 'board.png', { type: 'image/png' });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => expect(onFileAccepted).toHaveBeenCalledWith(file));
  });

  it('shows the drag-active state while a file is dragged over', async () => {
    const { container } = render(
      <DropZone accept={{ 'image/*': ['.png'] }} onFileAccepted={() => {}} />
    );
    const root = container.firstChild as HTMLElement;
    await act(async () => {
      fireEvent.dragEnter(root, {
        dataTransfer: {
          types: ['Files'],
          files: [],
          items: [{ kind: 'file', type: 'image/png' }]
        }
      });
    });
    expect(screen.getByText('ファイルをドロップ')).toBeInTheDocument();
  });
});
