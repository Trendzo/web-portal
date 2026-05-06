import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Check, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AspectOption = { label: string; value: number | undefined };
const ASPECTS: AspectOption[] = [
  { label: '3:4', value: 3 / 4 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: 'Free', value: undefined },
];

type Props = {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob, originalName: string) => void | Promise<void>;
  uploading: boolean;
};

/**
 * Crop / aspect-ratio / zoom / rotate dialog. Returns a JPEG blob of the cropped
 * region to the parent via `onConfirm`. The parent owns the upload step so the same
 * dialog can be reused anywhere we need pre-upload cropping (store photos, support
 * attachments, etc.).
 */
export default function CropDialog({ file, onCancel, onConfirm, uploading }: Props) {
  // Read the file into a data URL once. Object URLs trip on React 19 StrictMode's
  // double-mount (the dev cleanup revokes the URL before the second mount), and the
  // Cropper ends up rendering a black canvas with nothing to load. Data URLs have no
  // lifecycle to manage. Cost is the ~33% size bump from base64 — fine for one-shot
  // crop sessions capped at 25 MB on the upload side.
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (!cancelled && typeof reader.result === 'string') setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
    return () => {
      cancelled = true;
    };
  }, [file]);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  // Default 3:4 — typical portrait for fashion product cards.
  const [aspect, setAspect] = useState<number | undefined>(3 / 4);
  const croppedAreaRef = useRef<Area | null>(null);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    croppedAreaRef.current = areaPixels;
  }, []);

  const handleConfirm = async () => {
    const area = croppedAreaRef.current;
    if (!area || !imageUrl) return;
    const blob = await getCroppedBlob(imageUrl, area, rotation);
    await onConfirm(blob, file.name);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !uploading) onCancel(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crop image</DialogTitle>
          <DialogDescription>
            Drag to pan, scroll or pinch to zoom. Pick an aspect ratio for consistent
            product cards.
          </DialogDescription>
        </DialogHeader>

        {/* Crop surface */}
        <div className="relative h-[420px] overflow-hidden rounded-xs border border-ink/80 bg-ink/95">
          {imageUrl ? (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              zoomWithScroll
              showGrid
              objectFit={aspect ? 'contain' : 'horizontal-cover'}
            />
          ) : (
            <div className="grid h-full place-items-center text-paper/70">
              <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em]">
                <Loader2 className="size-4 animate-spin" />
                Loading image…
              </div>
            </div>
          )}
        </div>

        {/* Controls strip */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="kicker mb-1 text-ink-3">Aspect ratio</div>
            <div className="flex flex-wrap gap-1">
              {ASPECTS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => setAspect(a.value)}
                  className={cn(
                    'rounded-xs border px-3 py-1.5 text-[12px] uppercase tracking-[0.12em] transition-colors',
                    aspect === a.value
                      ? 'border-ink bg-ink text-paper'
                      : 'border-rule text-ink-2 hover:border-ink hover:text-ink',
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full sm:w-72">
            <label htmlFor="cropZoom" className="kicker mb-1 block text-ink-3">
              Zoom · {zoom.toFixed(2)}×
            </label>
            <input
              id="cropZoom"
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconLeft={<RotateCw className="size-3.5" />}
            onClick={() => setRotation((r) => (r + 90) % 360)}
            disabled={uploading}
          >
            Rotate 90°
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="ink"
            caps
            iconLeft={<Check className="size-3.5" />}
            loading={uploading}
            onClick={handleConfirm}
          >
            Use crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Canvas-based cropping ───────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Apply the cropper's selected area + rotation to the source image and return a JPEG
 * blob. Rotation is handled by drawing the rotated full image onto an oversized
 * canvas first, then sampling the cropped area out of that.
 */
async function getCroppedBlob(imageSrc: string, area: Area, rotation: number): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const radians = (rotation * Math.PI) / 180;

  // Compute the rotated bounding box so we have a canvas big enough to hold the
  // image at any rotation without clipping.
  const { width: bWidth, height: bHeight } = rotatedBounds(img.width, img.height, radians);
  const stage = document.createElement('canvas');
  stage.width = bWidth;
  stage.height = bHeight;
  const sctx = stage.getContext('2d');
  if (!sctx) throw new Error('Canvas 2D context unavailable');

  sctx.translate(bWidth / 2, bHeight / 2);
  sctx.rotate(radians);
  sctx.drawImage(img, -img.width / 2, -img.height / 2);

  // The cropper reports area coords against the original (unrotated) image. With
  // rotation, those coords are still valid against our rotated stage as long as we
  // shift them by the bounding-box origin (which is half the width/height delta).
  const offsetX = (bWidth - img.width) / 2;
  const offsetY = (bHeight - img.height) / 2;

  const out = document.createElement('canvas');
  out.width = area.width;
  out.height = area.height;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas 2D context unavailable');

  octx.drawImage(
    stage,
    area.x + offsetX,
    area.y + offsetY,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height,
  );

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode crop'))),
      'image/jpeg',
      0.92,
    );
  });
}

function rotatedBounds(w: number, h: number, radians: number) {
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return { width: w * cos + h * sin, height: w * sin + h * cos };
}
