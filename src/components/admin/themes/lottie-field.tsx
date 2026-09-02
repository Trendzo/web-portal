import { lazy, Suspense, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { FileField } from '@/components/ui/file-field';
import { Button } from '@/components/ui/button';

// lottie-web is ~250 KB — only load it once there is actually a file to preview.
const LottiePreview = lazy(() => import('./lottie-preview'));

const MAX_BYTES = 512 * 1024;

function validateLottie(file: File, text: string): string | null {
  // FileField runs validate before its generic size gate, so the budget message
  // here is the one editors actually see.
  if (file.size > MAX_BYTES) {
    return `This animation is ${Math.round(file.size / 1024)} KB — keep it under 512 KB; it ships to every phone.`;
  }
  try {
    const j: unknown = JSON.parse(text);
    const obj = typeof j === 'object' && j !== null ? (j as Record<string, unknown>) : null;
    const isLottie =
      obj !== null &&
      typeof obj.v === 'string' &&
      Array.isArray(obj.layers) &&
      typeof obj.op === 'number';
    return isLottie ? null : 'Not a Lottie animation (missing v/layers/op)';
  } catch {
    return 'Not a Lottie animation (missing v/layers/op)';
  }
}

/**
 * Upload field for a theme's Lottie animation: validates the JSON is actually a
 * Lottie export before uploading, then previews it inline (lazy-loaded player)
 * with a play/pause toggle.
 */
export function LottieField({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean | undefined;
}) {
  const [paused, setPaused] = useState(false);

  return (
    <div className="space-y-2">
      <FileField
        accept="application/json"
        maxBytes={MAX_BYTES}
        value={value}
        onChange={onChange}
        uploadFolder="themes"
        purpose="theme-lottie"
        validate={validateLottie}
        disabled={disabled}
      />
      {value && (
        <div>
          <Suspense fallback={null}>
            <LottiePreview url={value} loop paused={paused} />
          </Suspense>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              iconLeft={paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? 'Play' : 'Pause'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
