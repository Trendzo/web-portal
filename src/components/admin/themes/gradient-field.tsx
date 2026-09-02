import { ColorPicker } from '@/components/ui/color-picker';

/** Seed used when the tuple is unset (matches the app's default festive gradient). */
const SEED: [string, string] = ['#7B1E1E', '#C1121F'];

/**
 * Two-stop vertical gradient editor: a live swatch bar plus a ColorPicker per stop.
 * An undefined value renders (and commits on first edit) the seed pair.
 */
export function GradientField({
  value,
  onChange,
  disabled = false,
}: {
  value: [string, string] | undefined;
  onChange: (v: [string, string]) => void;
  disabled?: boolean | undefined;
}) {
  const [top, bottom] = value ?? SEED;

  return (
    <div className="space-y-2">
      <div
        className="h-8 w-full rounded-md border border-line"
        style={{ background: `linear-gradient(180deg, ${top}, ${bottom})` }}
        aria-hidden
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="kicker mb-1 text-ink-3">Top</div>
          {/* ColorPicker's Clear hands back '' — fall back to the seed so the tuple stays valid hex. */}
          <ColorPicker
            value={top}
            onChange={(next) => onChange([next || SEED[0], bottom])}
            disabled={disabled}
          />
        </div>
        <div>
          <div className="kicker mb-1 text-ink-3">Bottom</div>
          <ColorPicker
            value={bottom}
            onChange={(next) => onChange([top, next || SEED[1]])}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
