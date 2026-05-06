import { lazy, Suspense, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Image as ImageIcon, Loader2, Plus, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadMedia } from '@/lib/upload';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';

// react-easy-crop pulls in ~30 KB; lazy so it only loads when the user actually picks
// a file to crop.
const CropDialog = lazy(() => import('./crop-dialog'));

type Props = {
  urls: string[];
  /** Called with the new array whenever the user adds, removes, or reorders. */
  onChange: (next: string[]) => void;
  /** Cloudinary sub-folder for organisation, e.g. `products/<listingId>`. */
  uploadFolder?: string;
  /** Show a busy state on operations triggered externally (e.g. parent's PATCH). */
  busy?: boolean;
};

/**
 * Editorial-style image gallery editor.
 *  - Drag-and-drop a file *or* click the drop zone to pick one
 *  - Crop / aspect-ratio / zoom in a modal before upload (lazy-loaded)
 *  - Sortable thumbnail grid (the first thumbnail is the cover)
 *  - "Add by URL" fallback for already-hosted images
 *
 * Reordering and removal both fire `onChange` with the new full array; the parent
 * is responsible for persisting (PATCH /retailer/listings/:id { galleryUrls }).
 */
export function MediaGallery({ urls, onChange, uploadFolder, busy }: Props) {
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    accept: { 'image/*': [] },
    multiple: false,
    maxSize: 25 * 1024 * 1024,
    noClick: false,
    onDrop: (accepted, rejected) => {
      if (rejected.length > 0) {
        const first = rejected[0]?.errors?.[0];
        toast.error(first?.message ?? 'That file was rejected.');
        return;
      }
      const file = accepted[0];
      if (file) setPickedFile(file);
    },
  });

  const handleCropConfirm = async (blob: Blob, originalName: string) => {
    setUploading(true);
    try {
      const file = new File([blob], originalName, { type: blob.type || 'image/jpeg' });
      const result = await uploadMedia(file, uploadFolder ? { folder: uploadFolder } : {});
      onChange([...urls, result.url]);
      setPickedFile(null);
      toast.success('Image added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = () => {
    const url = newUrl.trim();
    if (!url) {
      setUrlError('Paste an image URL first.');
      return;
    }
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs');
    } catch {
      setUrlError("That doesn't look like a valid http(s) URL.");
      return;
    }
    if (urls.includes(url)) {
      setUrlError('That URL is already in the gallery.');
      return;
    }
    setUrlError(null);
    onChange([...urls, url]);
    setNewUrl('');
  };

  const handleRemove = (url: string) => onChange(urls.filter((u) => u !== url));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = urls.indexOf(active.id as string);
    const newIndex = urls.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(urls, oldIndex, newIndex));
  };

  return (
    <div className="space-y-5">
      {/* Preview grid */}
      {urls.length > 0 ? (
        <div>
          <div className="kicker mb-2 text-ink-3 flex items-center justify-between">
            <span>Gallery · {urls.length} {urls.length === 1 ? 'image' : 'images'}</span>
            <span className="normal-case tracking-normal text-[11px] text-ink-4">
              Drag to reorder · first is the cover
            </span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={urls} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {urls.map((url, i) => (
                  <SortableThumb
                    key={url}
                    url={url}
                    isCover={i === 0}
                    onRemove={() => handleRemove(url)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <p className="text-[13px] text-ink-3">
          No images yet. Drop a file below, or paste a hosted image URL.
        </p>
      )}

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'group relative cursor-pointer rounded-xs border-2 border-dashed px-5 py-7 text-center transition-colors',
          isDragReject
            ? 'border-danger bg-danger-soft/40'
            : isDragActive
              ? 'border-accent bg-accent-soft/60'
              : 'border-rule-strong bg-paper-2/30 hover:border-ink hover:bg-paper-2/50',
          busy && 'pointer-events-none opacity-60',
        )}
        aria-label="Drop image to upload, or click to pick a file"
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <>
              <Loader2 className="size-5 animate-spin text-ink-2" />
              <p className="text-[13.5px] text-ink-2">Uploading…</p>
            </>
          ) : (
            <>
              <span className="grid size-10 place-items-center rounded-full bg-paper-2 text-ink-2">
                <Upload className="size-4" />
              </span>
              <p className="text-[14px] text-ink">
                {isDragActive
                  ? isDragReject
                    ? 'That file type isn\'t supported'
                    : 'Drop to upload'
                  : <><span className="font-medium">Drop an image here</span> or click to choose</>}
              </p>
              <p className="text-[11.5px] uppercase tracking-[0.14em] text-ink-3">
                JPG, PNG, WebP · up to 25 MB · crop before upload
              </p>
            </>
          )}
        </div>
        {/* The whole card is the picker; an explicit button helps mobile / keyboard users */}
        {!isDragActive && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className="absolute right-3 top-3 text-[11px] uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
          >
            Choose file
          </button>
        )}
      </div>

      {/* URL paste fallback */}
      <div className="border-t border-rule pt-5">
        <Label htmlFor="gUrl" hint="paste a hosted image URL">
          Or add by URL
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              id="gUrl"
              value={newUrl}
              onChange={(e) => {
                setNewUrl(e.target.value);
                if (urlError) setUrlError(null);
              }}
              placeholder="e.g. https://cdn.example.com/photo.jpg"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddUrl();
                }
              }}
            />
            <FieldError>{urlError}</FieldError>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            iconLeft={<Plus className="size-3.5" />}
            onClick={handleAddUrl}
            disabled={!newUrl.trim()}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Crop modal — lazy-loaded, only mounts when there's a picked file */}
      <Suspense fallback={null}>
        {pickedFile && (
          <CropDialog
            file={pickedFile}
            onCancel={() => setPickedFile(null)}
            onConfirm={handleCropConfirm}
            uploading={uploading}
          />
        )}
      </Suspense>
    </div>
  );
}

// ── Sortable thumbnail tile ─────────────────────────────────────────

function SortableThumb({
  url,
  isCover,
  onRemove,
}: {
  url: string;
  isCover: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: url,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative aspect-square overflow-hidden rounded-xs border bg-paper-2',
        isDragging ? 'border-ink shadow-lg' : 'border-rule',
      )}
    >
      {/* Drag handle covers the whole tile (except the remove button) */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        aria-label={`Reorder image — ${url}`}
      />
      <ThumbImage url={url} />
      {isCover && (
        <span className="absolute left-2 top-2 rounded-xs bg-ink/90 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-paper">
          Cover
        </span>
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-ink/90 text-paper opacity-0 transition-opacity hover:bg-danger group-hover:opacity-100 focus-visible:opacity-100"
        aria-label="Remove image"
      >
        <X className="size-3" />
      </button>
    </li>
  );
}

function ThumbImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="grid h-full place-items-center text-ink-3">
        <ImageIcon className="size-5" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      // `object-contain` so the thumbnail shows the *true* aspect of what was cropped —
      // a 3:4 portrait crop appears as 3:4, not visually re-clipped to a square.
      className="h-full w-full object-contain"
      draggable={false}
    />
  );
}
