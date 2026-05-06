import { Check, ImageOff, Star } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = {
  gallery: string[];
  selected: string[];
  onChange: (next: string[]) => void;
};

/**
 * Variant images aren't uploaded separately — they're picked from the listing's
 * media library (Shopify pattern: one product, many variants, one shared media set).
 * Click to toggle. The first selected URL is the variant's primary image (used in the
 * card render); a Star button reassigns primary without losing the rest of the pick.
 */
export function VariantImagePicker({ gallery, selected, onChange }: Props) {
  if (gallery.length === 0) {
    return (
      <div className="rounded-xs border border-dashed border-rule bg-paper-2 px-4 py-6 text-center">
        <ImageOff className="mx-auto mb-2 size-5 text-ink-3" />
        <p className="text-[13px] text-ink-2">
          No product images yet. Add images on the <span className="text-ink">Details</span> tab,
          then come back to pick which ones belong to this variant.
        </p>
      </div>
    );
  }

  const selectedSet = new Set(selected);
  const primary = selected[0] ?? null;

  function toggle(url: string) {
    if (selectedSet.has(url)) {
      onChange(selected.filter((u) => u !== url));
    } else {
      onChange([...selected, url]);
    }
  }

  function makePrimary(url: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!selectedSet.has(url)) return;
    onChange([url, ...selected.filter((u) => u !== url)]);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] text-ink-3">
          Pick which of the product's images apply to this variant. The first pick is the variant's primary image.
        </p>
        <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">
          {selected.length} of {gallery.length} selected
        </span>
      </div>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {gallery.map((url) => {
          const isSelected = selectedSet.has(url);
          const isPrimary = url === primary;
          return (
            <li key={url}>
              <button
                type="button"
                onClick={() => toggle(url)}
                aria-pressed={isSelected}
                className={cn(
                  'group relative block aspect-square w-full overflow-hidden rounded-xs border bg-paper-2 transition-colors',
                  isSelected
                    ? 'border-ink shadow-[2px_3px_0_-1px_rgba(26,20,16,0.18)]'
                    : 'border-rule hover:border-ink-3',
                )}
              >
                <img src={url} alt="" loading="lazy" className="size-full object-contain" />

                {/* Dim the unselected ones a hair so the chosen set reads as the active group. */}
                {!isSelected && (
                  <span className="pointer-events-none absolute inset-0 bg-paper/35 transition-opacity group-hover:opacity-0" />
                )}

                {/* Selection check */}
                {isSelected && (
                  <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-ink text-paper">
                    <Check className="size-3" />
                  </span>
                )}

                {/* Primary marker / promote-to-primary */}
                {isSelected && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => makePrimary(url, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        makePrimary(url, e as unknown as React.MouseEvent);
                      }
                    }}
                    aria-label={isPrimary ? 'Primary variant image' : 'Set as primary'}
                    title={isPrimary ? 'Primary image' : 'Set as primary'}
                    className={cn(
                      'absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full transition-colors',
                      isPrimary
                        ? 'bg-warning text-ink'
                        : 'bg-paper/90 text-ink-3 hover:bg-paper hover:text-ink',
                    )}
                  >
                    <Star className={cn('size-3', isPrimary && 'fill-current')} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
