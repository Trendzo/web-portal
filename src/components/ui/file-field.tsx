import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { FileText, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { uploadMedia } from '@/lib/upload';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

/** Whatever union upload.ts currently accepts — derived so this stays generic. */
type UploadPurpose = NonNullable<NonNullable<Parameters<typeof uploadMedia>[1]>['purpose']>;

function fmtBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Loose accept matcher for drag-and-drop (the hidden input's `accept` only filters the picker). */
function matchesAccept(accept: string, file: File): boolean {
  const tokens = accept.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return true;
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return tokens.some((t) => {
    if (t.startsWith('.')) return name.endsWith(t);
    if (!type) return true; // e.g. Windows reports no mime for .json — let `validate` decide
    if (t.endsWith('/*')) return type.startsWith(t.slice(0, -1));
    return type === t;
  });
}

/**
 * Generic NON-image upload field (MediaGallery hardcodes image mimes): a bordered
 * drop-target plus hidden file input. Reads the file as text, runs the caller's
 * `validate` (return a string to reject with that message — this runs BEFORE the
 * generic size gate so callers can brand their own size messaging), enforces
 * `maxBytes`, then uploads via `uploadMedia` with a live progress bar.
 */
export function FileField({
  accept,
  maxBytes,
  value,
  onChange,
  uploadFolder,
  purpose,
  validate,
  disabled = false,
}: {
  accept: string;
  maxBytes: number;
  value: string | null;
  onChange: (url: string | null) => void;
  uploadFolder?: string | undefined;
  purpose?: string | undefined;
  validate?: ((file: File, text: string) => string | null) | undefined;
  disabled?: boolean | undefined;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const uploading = progress !== null;

  const handleFile = async (file: File) => {
    if (disabled || uploading) return;
    if (!matchesAccept(accept, file)) {
      toast.error(`That file isn't ${accept}.`);
      return;
    }
    // Don't read absurdly large files into memory just to reject them.
    if (file.size > maxBytes && file.size > 8 * 1024 * 1024) {
      toast.error(`File is ${fmtBytes(file.size)} — the limit for this field is ${fmtBytes(maxBytes)}.`);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.error('Could not read that file.');
      return;
    }
    if (validate) {
      const rejection = validate(file, text);
      if (rejection) {
        toast.error(rejection);
        return;
      }
    }
    if (file.size > maxBytes) {
      toast.error(`File is ${fmtBytes(file.size)} — the limit for this field is ${fmtBytes(maxBytes)}.`);
      return;
    }
    setProgress(0);
    try {
      const result = await uploadMedia(file, {
        ...(uploadFolder ? { folder: uploadFolder } : {}),
        ...(purpose ? { purpose: purpose as UploadPurpose } : {}),
        onProgress: setProgress,
      });
      onChange(result.url);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Upload failed');
    } finally {
      setProgress(null);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file after a rejection
    if (file) void handleFile(file);
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-line bg-bg-2 px-3 py-2">
        <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2" title={value}>
          {value}
        </span>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)}>
          Clear
        </Button>
      </div>
    );
  }

  if (uploading) {
    return (
      <div className="space-y-1.5 rounded-md border border-line bg-bg px-3 py-3">
        <div className="flex items-center justify-between text-[12px] text-ink-2">
          <span>Uploading…</span>
          <span className="font-mono tabular-nums">{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-3">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-6 text-center transition-colors',
        dragActive ? 'border-accent bg-bg-2' : 'border-line-2 bg-bg hover:border-line-strong',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <UploadCloud className="size-5 text-ink-3" aria-hidden />
      <p className="text-[13px] text-ink-2">Drop a file here, or click to browse</p>
      <p className="font-mono text-[11px] text-ink-3">
        {accept} · up to {fmtBytes(maxBytes)}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}
