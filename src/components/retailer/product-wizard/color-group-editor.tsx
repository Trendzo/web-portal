import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, ChevronDown, ChevronRight, Copy, Info, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { SizeScale } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorSwatchPicker } from './color-swatch-picker';
import { SizePresetChips } from './size-preset-chips';
import { VariantRow } from './variant-row';
import { nextGroupKey, NO_SIZE, type GroupDraft, type SizeDraft } from './types';

/** Explains what "No colour" means and when a retailer should reach for it. */
function NoColorInfoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>No colour — when to use it</DialogTitle>
          <DialogDescription>
            For products that come in sizes but only one look.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-[13px] text-ink-2">
          <p>
            Pick <strong>No colour</strong> when the product has <strong>sizes but no colour choice</strong> —
            the customer picks a size and that's it. Each size becomes its own variant with its own
            price, SKU and stock.
          </p>
          <p className="text-ink-3">
            <strong className="text-ink-2">Use it for:</strong> a tee sold in one shade only (S/M/L/XL),
            shoes in a single colourway (UK 6–11), a belt in one finish (30/32/34).
          </p>
          <p className="text-ink-3">
            <strong className="text-ink-2">Don't use it when:</strong> the product has more than one colour —
            add each colour instead, so shoppers can filter and switch between them. And if it has
            neither colour nor size (one price, one SKU), go back and choose{' '}
            <strong className="text-ink-2">Single product</strong>.
          </p>
          <p className="rounded-md border border-rule bg-paper-2/40 px-3 py-2 text-[12.5px] text-ink-3">
            Variants will be named by size alone — <span className="font-mono">M</span>, not{' '}
            <span className="font-mono">Black / M</span>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The system color → sizes editor. One collapsible card per color: a size
 * chip picker on top (size systems resolved from the listing's category —
 * UK/US/EU for footwear, Letter/Waist for apparel, …), one VariantRow per
 * size beneath, and a copy-across convenience that stamps the first size's
 * price/MRP/stock onto the rest. Colors carry a free-form label plus an
 * optional exact-hex swatch.
 */
export function ColorGroupEditor({
  groups,
  setGroups,
  gallery,
  listingId,
  categoryId,
  onReload,
}: {
  groups: GroupDraft[];
  setGroups: (g: GroupDraft[]) => void;
  gallery: string[];
  listingId: string | null;
  categoryId: string | null;
  onReload: () => void;
}) {
  const [newColor, setNewColor] = useState('');
  const [newHex, setNewHex] = useState<string | null>(null);
  const [noColorInfo, setNoColorInfo] = useState(false);

  const noColorGroup = groups.find((g) => g.isNoColor) ?? null;
  const hasNamedColors = groups.some((g) => !g.isNoColor);

  // Category-aware size systems; universal scales come back even without a category.
  const scalesQ = useQuery({
    queryKey: ['catalog', 'size-scales', categoryId],
    queryFn: () =>
      api<SizeScale[]>(`/catalog/size-scales${categoryId ? `?categoryId=${categoryId}` : ''}`),
  });
  const scales = scalesQ.data ?? [];

  function addColor() {
    const name = newColor.trim();
    if (!name) return;
    if (noColorGroup) {
      toast.error('This product is set to "No colour" — remove that card to add colours');
      return;
    }
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Color "${name}" already exists`);
      return;
    }
    setGroups([
      ...groups,
      { clientKey: nextGroupKey(), name, colorHex: newHex, sortOrder: groups.length, sizes: [] },
    ]);
    setNewColor('');
    setNewHex(null);
  }

  /** "No colour": a size-only product. Mutually exclusive with named colours. */
  function addNoColor() {
    if (noColorGroup) return;
    if (hasNamedColors) {
      toast.error('Remove the colours first — a product is either colourless or has colours');
      return;
    }
    setGroups([
      ...groups,
      {
        clientKey: nextGroupKey(),
        name: 'No colour',
        colorHex: null,
        sortOrder: 0,
        sizes: [],
        isNoColor: true,
      },
    ]);
    setNewColor('');
    setNewHex(null);
  }

  function patchGroup(key: string, patch: Partial<GroupDraft>) {
    setGroups(groups.map((g) => (g.clientKey === key ? { ...g, ...patch } : g)));
  }

  function removeGroup(key: string) {
    const g = groups.find((x) => x.clientKey === key);
    if (!g) return;
    const savedWithStock = g.sizes.filter((s) => s.id && (s.stock ?? 0) > 0);
    if (savedWithStock.length > 0) {
      const okGo = window.confirm(
        `Removing "${g.name}" deletes ${g.sizes.length} size(s) including stock on hand. Continue?`,
      );
      if (!okGo) return;
    }
    setGroups(groups.filter((x) => x.clientKey !== key));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-rule bg-paper-2/30 p-3">
        {/* First option: this product has no colour at all (sizes only). */}
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={addNoColor}
            disabled={!!noColorGroup || hasNamedColors}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors',
              noColorGroup
                ? 'border-ink bg-ink/4 text-ink ring-1 ring-ink/15'
                : hasNamedColors
                  ? 'cursor-not-allowed border-rule bg-bg text-ink-4'
                  : 'border-rule bg-bg text-ink-2 hover:border-ink-3 hover:text-ink',
            )}
            title={
              hasNamedColors
                ? 'Remove the colours first — a product is either colourless or has colours'
                : 'This product has no colour choice — only sizes'
            }
          >
            <Ban className="size-3.5" />
            <span>No colour</span>
          </button>
          <button
            type="button"
            onClick={() => setNoColorInfo(true)}
            aria-label="What does “No colour” mean?"
            className="text-ink-3 transition-colors hover:text-ink"
          >
            <Info className="size-3.5" />
          </button>
          <span className="text-[12px] text-ink-4">for products sold in sizes but only one look</span>
        </div>

        <div className={cn('flex items-end gap-2', noColorGroup && 'pointer-events-none opacity-40')}>
          <div className="max-w-xs flex-1">
            <Label hint="your own naming — Black, Midnight Green…">Add a color</Label>
            <Input
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addColor();
                }
              }}
              placeholder="e.g. Black, Navy, Starlight"
            />
          </div>
          <Button type="button" variant="outline" size="sm" iconLeft={<Plus className="size-3.5" />} onClick={addColor}>
            Add color
          </Button>
        </div>
        <div className={cn('mt-2', noColorGroup && 'pointer-events-none opacity-40')}>
          <ColorSwatchPicker
            value={newHex}
            onChange={setNewHex}
            onSuggestName={(name) => {
              if (!newColor.trim()) setNewColor(name);
            }}
          />
        </div>
      </div>

      <NoColorInfoDialog open={noColorInfo} onClose={() => setNoColorInfo(false)} />

      {groups.length === 0 ? (
        <p className="rounded-md border border-dashed border-rule px-4 py-6 text-center text-[13px] text-ink-3">
          Add a color above, then pick its sizes — or choose <strong className="font-medium text-ink-2">No colour</strong>{' '}
          if this product only comes in sizes.
        </p>
      ) : (
        groups.map((g) => (
          <ColorGroupCard
            key={g.clientKey}
            group={g}
            otherNames={groups.filter((x) => x.clientKey !== g.clientKey).map((x) => x.name)}
            gallery={gallery}
            listingId={listingId}
            scales={scales}
            onChange={(patch) => patchGroup(g.clientKey, patch)}
            onRemove={() => removeGroup(g.clientKey)}
            onReload={onReload}
          />
        ))
      )}
    </div>
  );
}

function emptySize(size: string, template?: SizeDraft): SizeDraft {
  return {
    size,
    attributes: {},
    attributesLabel: size || 'One size',
    sku: '',
    pricePaise: template?.pricePaise ?? null,
    compareAtPrice: template?.compareAtPrice ?? null,
    stock: template?.stock ?? 0,
    imageUrls: [],
    isActive: false,
  };
}

/** Mirrors the server's derived identity: "M" | "Black" | "Black / M". */
function rowLabel(group: GroupDraft, size: string): string {
  if (group.isNoColor) return size || 'One size';
  if (size === NO_SIZE) return group.name;
  return `${group.name} / ${size}`;
}

/** Explains what "No size" means and when a retailer should reach for it. */
function NoSizeInfoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>No size — when to use it</DialogTitle>
          <DialogDescription>For products that come in colours but one size only.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-[13px] text-ink-2">
          <p>
            Pick <strong>No size</strong> when this colour is <strong>one-size</strong> — the customer
            chooses a colour and that's it. The colour becomes a single variant with its own price,
            SKU and stock.
          </p>
          <p className="text-ink-3">
            <strong className="text-ink-2">Use it for:</strong> a handbag in Black / Tan / Red, a scarf
            or cap in several colours, a phone case per colour — anything free-size.
          </p>
          <p className="text-ink-3">
            <strong className="text-ink-2">Don't use it when:</strong> the colour is sold in sizes — add
            the sizes instead, so each has its own stock. And if the product has neither colour nor
            size, go back and choose <strong className="text-ink-2">Single product</strong>.
          </p>
          <p className="rounded-md border border-rule bg-paper-2/40 px-3 py-2 text-[12.5px] text-ink-3">
            The variant will be named by colour alone — <span className="font-mono">Black</span>, not{' '}
            <span className="font-mono">Black / M</span>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColorGroupCard({
  group,
  otherNames,
  gallery,
  listingId,
  scales,
  onChange,
  onRemove,
  onReload,
}: {
  group: GroupDraft;
  otherNames: string[];
  gallery: string[];
  listingId: string | null;
  scales: SizeScale[];
  onChange: (patch: Partial<GroupDraft>) => void;
  onRemove: () => void;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [showSwatch, setShowSwatch] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);
  const [noSizeInfo, setNoSizeInfo] = useState(false);

  const totalStock = group.sizes.reduce((sum, s) => sum + (s.stock ?? 0), 0);
  const isNoSize = group.sizes.length === 1 && group.sizes[0]!.size === NO_SIZE;
  const hasRealSizes = group.sizes.some((s) => s.size !== NO_SIZE);

  /** Toggle this colour into/out of "one size" (a single size-less variant). */
  function toggleNoSize() {
    if (isNoSize) {
      const row = group.sizes[0]!;
      if (row.id && (row.stock ?? 0) > 0) {
        const okGo = window.confirm(
          `Removing the one-size variant deletes its ${row.stock} unit(s) of stock. Continue?`,
        );
        if (!okGo) return;
      }
      onChange({ sizes: [] });
      return;
    }
    if (hasRealSizes) return;
    onChange({ sizes: [emptySize(NO_SIZE)] });
  }

  function commitName() {
    const name = nameDraft.trim();
    setEditingName(false);
    if (!name || name === group.name) {
      setNameDraft(group.name);
      return;
    }
    if (otherNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      toast.error(`Color "${name}" already exists`);
      setNameDraft(group.name);
      return;
    }
    onChange({ name });
  }

  function addSize(size: string) {
    if (group.sizes.some((s) => s.size.toLowerCase() === size.toLowerCase())) return;
    const first = group.sizes[0];
    onChange({ sizes: [...group.sizes, emptySize(size, first)] });
  }

  function removeSize(size: string) {
    const row = group.sizes.find((s) => s.size.toLowerCase() === size.toLowerCase());
    if (!row) return;
    if (row.id && (row.stock ?? 0) > 0) {
      const okGo = window.confirm(
        `Removing size ${row.size} deletes its ${row.stock} unit(s) of stock. Continue?`,
      );
      if (!okGo) return;
    }
    onChange({ sizes: group.sizes.filter((s) => s !== row) });
  }

  function patchSize(idx: number, patch: Partial<SizeDraft>) {
    onChange({ sizes: group.sizes.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
  }

  function copyAcross() {
    const first = group.sizes[0];
    if (!first) return;
    onChange({
      sizes: group.sizes.map((s, i) =>
        i === 0
          ? s
          : { ...s, pricePaise: first.pricePaise, compareAtPrice: first.compareAtPrice, stock: first.stock },
      ),
    });
    toast.success(`Copied ${first.size}'s price · MRP · stock to all sizes`);
  }

  return (
    <div className="rounded-lg border border-rule bg-paper-2/30">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {open ? <ChevronDown className="size-3.5 shrink-0 text-ink-3" /> : <ChevronRight className="size-3.5 shrink-0 text-ink-3" />}
          {group.isNoColor ? (
            <Ban className="size-3.5 shrink-0 text-ink-3" />
          ) : (
            <span
              className="size-4 shrink-0 rounded-sm border border-line"
              style={{ backgroundColor: group.colorHex ?? 'transparent' }}
              onClick={(e) => {
                e.stopPropagation();
                setShowSwatch((s) => !s);
                setOpen(true);
              }}
              title={group.colorHex ? `${group.colorHex} — click to change` : 'Set a swatch'}
            />
          )}
          {group.isNoColor ? (
            <span className="truncate text-[13.5px] font-medium text-ink">No colour</span>
          ) : editingName ? (
            <Input
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitName();
                }
                if (e.key === 'Escape') {
                  setNameDraft(group.name);
                  setEditingName(false);
                }
              }}
              className="h-7 max-w-44 text-[13px]"
            />
          ) : (
            <span
              className="truncate text-[13.5px] font-medium text-ink hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setEditingName(true);
              }}
              title="Click to rename"
            >
              {group.name}
            </span>
          )}
          <span className="shrink-0 text-[11.5px] text-ink-3">
            {group.sizes.length} size{group.sizes.length === 1 ? '' : 's'} · {totalStock} in stock
          </span>
        </button>
        <button type="button" onClick={onRemove} className="shrink-0 text-ink-3 hover:text-danger" aria-label={`Remove color ${group.name}`}>
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-rule/60 p-3">
          {showSwatch && !group.isNoColor && (
            <div className="rounded-md border border-rule/60 bg-bg p-2.5">
              <ColorSwatchPicker
                value={group.colorHex}
                onChange={(hex) => onChange({ colorHex: hex })}
              />
            </div>
          )}

          {/* First option: this colour has no size axis (a one-size variant).
              Not offered on the "No colour" card — that would leave zero axes. */}
          {!group.isNoColor && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleNoSize}
                disabled={hasRealSizes}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors',
                  isNoSize
                    ? 'border-ink bg-ink/4 text-ink ring-1 ring-ink/15'
                    : hasRealSizes
                      ? 'cursor-not-allowed border-rule bg-bg text-ink-4'
                      : 'border-rule bg-bg text-ink-2 hover:border-ink-3 hover:text-ink',
                )}
                title={
                  hasRealSizes
                    ? 'Remove the sizes first — this colour is either one-size or has sizes'
                    : 'This colour comes in one size only'
                }
              >
                <Ban className="size-3.5" />
                <span>No size</span>
              </button>
              <button
                type="button"
                onClick={() => setNoSizeInfo(true)}
                aria-label="What does “No size” mean?"
                className="text-ink-3 transition-colors hover:text-ink"
              >
                <Info className="size-3.5" />
              </button>
              <span className="text-[12px] text-ink-4">one-size — no size choice for this colour</span>
            </div>
          )}

          {!isNoSize && (
            <SizePresetChips
              scales={scales}
              selected={group.sizes.map((s) => s.size)}
              onAdd={addSize}
              onRemove={removeSize}
            />
          )}

          {group.sizes.length > 0 && (
            <div className="space-y-2">
              {group.sizes.map((s, i) => (
                <VariantRow
                  key={s.id ?? `${group.clientKey}-${s.size || 'onesize'}`}
                  draft={{ ...s, attributesLabel: rowLabel(group, s.size) }}
                  gallery={gallery}
                  galleryLen={gallery.length}
                  listingId={listingId}
                  showLabel
                  onChange={(patch) => patchSize(i, patch)}
                  onRemove={() => removeSize(s.size)}
                  onPublished={onReload}
                />
              ))}
              {group.sizes.length > 1 && (
                <button
                  type="button"
                  onClick={copyAcross}
                  className={cn('inline-flex items-center gap-1.5 text-[12px] text-accent hover:underline')}
                >
                  <Copy className="size-3" /> Copy {group.sizes[0]!.size}'s price · MRP · stock to all sizes
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <NoSizeInfoDialog open={noSizeInfo} onClose={() => setNoSizeInfo(false)} />
    </div>
  );
}
