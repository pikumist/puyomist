import { FileUpIcon } from 'lucide-react';
import { useCallback } from 'react';
import { type Accept, useDropzone } from 'react-dropzone';

import { cn } from '@/lib/utils';

interface DropZoneProps {
  /** Accepted file types. */
  accept: Accept;
  /** Called with the accepted file. */
  onFileAccepted: (file: File) => void;
  className?: string;
}

/** Drop-capable file input. */
const DropZone: React.FC<DropZoneProps> = (props) => {
  const { accept, onFileAccepted, className } = props;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFileAccepted(acceptedFiles[0]);
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex w-48 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-2 text-sm transition-colors',
        isDragActive
          ? 'border-primary bg-accent-muted'
          : 'border-border hover:bg-surface-raised',
        className
      )}
    >
      <input {...getInputProps()} />
      <FileUpIcon className="size-4" />
      <span>{isDragActive ? 'ファイルをドロップ' : 'ファイル選択'}</span>
    </div>
  );
};

export default DropZone;
