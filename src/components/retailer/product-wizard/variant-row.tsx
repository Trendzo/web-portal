import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VariantImagePicker } from '@/components/ui/variant-image-picker';
import { isVariantDraftComplete, type VariantDraft } from './types';

/**
 * Per-item price ceiling, in the unit the retailer actually types: RUPEES.
 * Mirrors MAX_PRICE_RUPEES in backend listings.validators.ts — keep the two equal.
 * The DB's real limit is the int4 column (₹2,14,74,836.47); this rounder cap sits
 * under it so the storage ceiling is never the thing a retailer bumps into.
 */
export const MAX_RUPEES = 1_00_00_000;
export const MAX_PAISE = MAX_RUPEES * 100;
/** Stock is a plain count, so its ceiling is the int4 column itself. */
export const MAX_INT4 = 2_147_483_647;

export const rupees = (paise: number | null) => (paise === null ? '' : (paise / 100).toString());
export const toPaise = (v: string): number | null => {
  const n = Number(v);
  return v.trim() === '' || Number.isNaN(n) ? null : Math.round(n * 100);
};

/**
 * One editable variant row: price / MRP / SKU / stock / images / publish.
 * Shared by the color-group editor (one row per size) and the custom-options
 * flow (one row per attribute combo).
 */
export function VariantRow({
  draft,
  gallery,
  galleryLen,
  listingId,
  showLabel,
  onChange,
  onRemove,
  onPublished,
}: {
  draft: VariantDraft;
  gallery: string[];
  galleryLen: number;
  listingId: string | null;
  showLabel: boolean;
  onChange: (patch: Partial<VariantDraft>) => void;
  onRemove?: (() => void) | undefined;
  onPublished: () => void;
}) {
  const qc = useQueryClient();
  const [pickImages, setPickImages] = useState(false);
  const complete = isVariantDraftComplete(draft, galleryLen);
  const compareInvalid =
    draft.compareAtPrice !== null && draft.pricePaise !== null && draft.compareAtPrice <= draft.pricePaise;
  // Money and stock land in Postgres `integer` columns. Anything past INT4_MAX used
  // to sail through the client, pass the server's (unbounded) schema, and die on the
  // INSERT as a bare 500. Flag it here so the number is fixed where it is typed.
  const priceTooBig = draft.pricePaise !== null && draft.pricePaise > MAX_PAISE;
  const compareTooBig = draft.compareAtPrice !== null && draft.compareAtPrice > MAX_PAISE;
  const stockTooBig = draft.stock !== null && draft.stock > MAX_INT4;

  const publish = useMutation({
    mutationFn: () => {
      if (!draft.isActive) {
        return api(`/retailer/listings/${listingId}/variants/${draft.id}/publish`, { method: 'POST' });
      }
      return api(`/retailer/variants/${draft.id}`, { method: 'PATCH', body: { isActive: false } });
    },
    onSuccess: () => {
      toast.success(draft.isActive ? 'Variant unpublished' : 'Variant published');
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
      onPublished();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Action failed';
      toast.error(msg);
    },
  });

  return (
    <div className="rounded-lg border border-rule bg-bg p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {showLabel && <span className="text-[13px] font-medium text-ink">{draft.attributesLabel}</span>}
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide',
              draft.isActive
                ? 'bg-success-soft text-success-strong'
                : complete
                  ? 'bg-bg-3 text-ink-2'
                  : 'bg-danger-soft text-danger',
            )}
          >
            {draft.isActive ? 'Published' : complete ? 'Ready' : 'Incomplete'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {draft.id && listingId && (
            <Button
              type="button"
              variant={draft.isActive ? 'ghost' : 'outline'}
              size="xs"
              loading={publish.isPending}
              disabled={!draft.isActive && !complete}
              onClick={() => publish.mutate()}
            >
              {draft.isActive ? 'Unpublish' : 'Publish'}
            </Button>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-ink-3 hover:text-danger" aria-label="Remove variant">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Selling price ₹" required>
          <Input
            value={rupees(draft.pricePaise)}
            onChange={(e) => onChange({ pricePaise: toPaise(e.target.value) })}
            inputMode="decimal"
            placeholder="999"
            className={priceTooBig ? 'border-danger' : undefined}
          />
        </Field>
        <Field label="MRP ₹">
          <Input
            value={rupees(draft.compareAtPrice)}
            onChange={(e) => onChange({ compareAtPrice: toPaise(e.target.value) })}
            inputMode="decimal"
            placeholder="—"
            className={compareInvalid || compareTooBig ? 'border-danger' : undefined}
          />
        </Field>
        <Field label="SKU" hint="auto">
          <Input value={draft.sku} onChange={(e) => onChange({ sku: e.target.value })} mono placeholder="auto" />
        </Field>
        <Field label="Stock">
          <Input
            value={draft.stock === null ? '' : String(draft.stock)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ stock: e.target.value.trim() === '' ? 0 : Number.isNaN(n) ? 0 : n });
            }}
            inputMode="numeric"
            placeholder="0"
            className={stockTooBig ? 'border-danger' : undefined}
          />
        </Field>
      </div>
      {compareInvalid && <p className="mt-1 text-[11px] text-danger">MRP must be above selling price.</p>}
      {(priceTooBig || compareTooBig) && (
        <p className="mt-1 text-[11px] text-danger">
          {`Prices must be ₹${MAX_RUPEES.toLocaleString('en-IN')} or less.`}
        </p>
      )}
      {stockTooBig && (
        <p className="mt-1 text-[11px] text-danger">
          {`Stock must be ${MAX_INT4.toLocaleString('en-IN')} or less.`}
        </p>
      )}

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setPickImages((s) => !s)}
          className="text-[12px] text-accent hover:underline"
        >
          {draft.imageUrls.length > 0 ? `${draft.imageUrls.length} image(s) · edit` : 'Pick variant images'}
        </button>
        {pickImages && (
          <div className="mt-2">
            <VariantImagePicker
              gallery={gallery}
              selected={draft.imageUrls}
              onChange={(next) => onChange({ imageUrls: next })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label hint={hint} required={required ?? false}>{label}</Label>
      {children}
    </div>
  );
}
