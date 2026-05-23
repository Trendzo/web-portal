import { useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Pipette } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Props = {
  /** Current colour as `#RRGGBB`. Empty string = unset. */
  value: string;
  onChange: (next: string) => void;
  /** Optional preset swatches shown below the wheel. */
  presets?: string[];
  /** Trigger button label override; defaults to "Pick a colour". */
  placeholder?: string;
  disabled?: boolean;
};

const DEFAULT_PRESETS = [
  '#1A1410', // ink
  '#F4EEE2', // paper
  '#C24A3B', // brick
  '#D4A24C', // mustard
  '#7A8B5C', // moss
  '#3F5B6A', // slate-blue
  '#A4624B', // terracotta
  '#5C3A4A', // plum
];

/**
 * Hex colour picker built around `react-colorful`'s saturation/value canvas + hue
 * rail. Anchored in a popover so it doesn't disrupt form layout. Accepts typed hex
 * input as a fallback for users who already know the code; the swatches let
 * common brand tones be picked in one click.
 */
export function ColorPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  placeholder = 'Pick a colour',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || '#000000');

  useEffect(() => {
    if (open) setDraft(value || '#000000');
  }, [open, value]);

  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(draft);
  const previewColor = isValidHex ? draft : value || '#FFFFFF';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full items-center gap-3 rounded-xs border border-rule bg-surface px-3 py-2',
            'text-left text-[13.5px] hover:border-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <span
            className="size-6 shrink-0 rounded-xs border border-ink/30"
            style={{ background: previewColor }}
            aria-hidden
          />
          <span className={cn('flex-1 font-mono text-[13px]', value ? 'text-ink' : 'text-ink-3')}>
            {value || placeholder}
          </span>
          <Pipette className="size-4 text-ink-3" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[260px] p-0" align="start">
        {/* Picker canvas — the .trendzo-colorful CSS in index.css trims rounding,
            sizes the canvas to popover width, and recolours the hue/alpha pointers
            so they read against our paper palette. */}
        <div className="trendzo-colorful px-3 pt-3">
          <HexColorPicker color={isValidHex ? draft : '#000000'} onChange={setDraft} />
        </div>

        <div className="px-3 pt-3">
          <div className="kicker mb-2 text-ink-3">Hex</div>
          <div className="flex items-center gap-2">
            <span
              className="size-7 shrink-0 rounded-xs border border-ink/30"
              style={{ background: previewColor }}
            />
            <Input
              mono
              value={draft}
              onChange={(e) => {
                const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                setDraft(next.slice(0, 7).toUpperCase());
              }}
              placeholder="#000000"
            />
          </div>
        </div>

        {presets.length > 0 && (
          <div className="px-3 pt-3">
            <div className="kicker mb-2 text-ink-3">Presets</div>
            <div className="grid grid-cols-8 gap-1.5">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-label={p}
                  onClick={() => setDraft(p.toUpperCase())}
                  className={cn(
                    'size-6 rounded-xs border transition-transform hover:scale-110',
                    draft.toLowerCase() === p.toLowerCase()
                      ? 'border-ink shadow-[1px_1px_0_-0.5px_rgba(26,20,16,0.4)]'
                      : 'border-ink/30',
                  )}
                  style={{ background: p }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule px-3 py-2.5">
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Clear
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="ink"
              size="sm"
              caps
              disabled={!isValidHex}
              onClick={() => {
                onChange(draft.toUpperCase());
                setOpen(false);
              }}
            >
              Use
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
