import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Edit3, ImageOff, Plus, Save, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { MediaGallery } from '@/components/ui/media-gallery';
import { VariantImagePicker } from '@/components/ui/variant-image-picker';
import { listingStatusMeta, formatPaise } from '@/lib/status';
import type { Listing, Variant } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const InventoryPatchSchema = z.object({
  pricePaise: z.coerce.number().int().positive(),
  stock: z.coerce.number().int().nonnegative(),
  sku: z.string().trim().min(1).max(64).optional().or(z.literal('').transform(() => undefined)),
});
type InventoryPatchValues = z.infer<typeof InventoryPatchSchema>;

/** A single (option name → value) row in the variant builder, e.g. `{ name: 'Size', value: 'M' }`. */
type OptionRow = { name: string; value: string };

/** Fold the option rows into the `attributes` map the backend stores. */
function attrsFromOptions(options: OptionRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { name, value } of options) {
    const key = name.trim().toLowerCase();
    const val = value.trim();
    if (key && val) out[key] = val;
  }
  return out;
}

/** Auto-derive a human label from the option values, e.g. "M / Black". */
function labelFromOptions(options: OptionRow[]): string {
  const parts = options
    .map((o) => o.value.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'Default';
}

export default function ListingDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const listing = useQuery({
    queryKey: ['retailer', 'listing', id],
    queryFn: async () => {
      const all = await api<Listing[]>('/retailer/listings');
      const found = all.find((l) => l.id === id);
      if (!found) throw new ApiError(404, 'not_found', 'Listing not found');
      return found;
    },
  });

  if (listing.isLoading) {
    return (
      <Page>
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="mt-4 h-72" />
      </Page>
    );
  }
  if (listing.isError || !listing.data) {
    return (
      <Page>
        <Empty
          kicker="Not found"
          title="Couldn't find this product."
          description={listing.error instanceof ApiError ? listing.error.message : 'Unknown error'}
          action={<Button asChild variant="outline"><Link to="/retailer/listings">Back to products</Link></Button>}
        />
      </Page>
    );
  }

  const l = listing.data;
  const meta = listingStatusMeta(l.status);

  return (
    <Page>
      <Link
        to="/retailer/listings"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All products
      </Link>

      <PageHeader
        kicker={`${l.brand?.name ?? 'Unbranded'} · ${l.category?.label ?? l.categoryId}`}
        title={<em>{l.name}</em>}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {l.badge !== 'none' && <Badge flat>{l.badge}</Badge>}
          </div>
        }
      />

      <PublishPanel
        listing={l}
        onChanged={() => qc.invalidateQueries({ queryKey: ['retailer'] })}
      />

      <Tabs defaultValue="variants">
        <TabsList>
          <TabsTrigger value="variants">Variants & inventory</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="variants">
          <VariantsTab listing={l} onChanged={() => qc.invalidateQueries({ queryKey: ['retailer'] })} />
        </TabsContent>
        <TabsContent value="details">
          <DetailsTab listing={l} onChanged={() => qc.invalidateQueries({ queryKey: ['retailer'] })} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function VariantsTab({ listing, onChanged }: { listing: Listing; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Variant | null>(null);
  const variants = listing.variants ?? [];

  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-3">
        <SectionHeading
          title="Variants"
          hint={`${variants.length} on file`}
        />
      </div>
      <div className="-mt-4 mb-6 flex justify-end">
        <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
          New variant
        </Button>
      </div>

      {variants.length === 0 ? (
        <Empty
          kicker="No variants"
          title="No variants yet."
          description="Add a variant to start tracking inventory — size, colour, SKU, and stock."
          action={
            <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
              Add variant
            </Button>
          }
        />
      ) : (
        <div className="border-t border-b border-ink/80 overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-rule">
                <Th className="w-[5%]">№</Th>
                <Th className="w-[8%]">Image</Th>
                <Th className="w-[30%]">Variant</Th>
                <Th className="w-[18%]">SKU</Th>
                <Th className="w-[14%] text-right">Price</Th>
                <Th className="w-[10%] text-right">Stock</Th>
                <Th className="w-[8%] text-right">Held</Th>
                <Th className="w-[7%] text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {variants.map((v, i) => (
                <tr key={v.id} className="hover:bg-surface/40">
                  <Td className="font-mono text-[11px] text-ink-3 align-middle">
                    {String(i + 1).padStart(2, '0')}
                  </Td>
                  <Td className="align-middle">
                    <VariantThumb urls={v.imageUrls ?? []} />
                  </Td>
                  <Td>
                    <div className="font-medium text-ink">{v.attributesLabel}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      {Object.entries(v.attributes).length > 0
                        ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' · ')
                        : 'No options'}
                    </div>
                  </Td>
                  <Td className="font-mono text-[12.5px]">
                    {v.sku ?? <span className="text-ink-4">—</span>}
                  </Td>
                  <Td className="text-right font-mono text-[14px] tabular-nums">
                    {formatPaise(v.pricePaise)}
                  </Td>
                  <Td className="text-right font-mono text-[14px] tabular-nums">{v.stock}</Td>
                  <Td className="text-right font-mono text-[13px] text-ink-3 tabular-nums">{v.reserved}</Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<Edit3 className="size-3.5" />}
                      onClick={() => setEditing(v)}
                    >
                      Edit
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateVariantDialog
        open={adding}
        onOpenChange={setAdding}
        listingId={listing.id}
        gallery={listing.galleryUrls ?? []}
        existingVariants={variants}
        onCreated={onChanged}
      />
      <EditInventoryDialog
        target={editing}
        gallery={listing.galleryUrls ?? []}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
    </>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        'kicker text-ink-3 px-3 py-3 text-left ' + (className ?? '')
      }
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={'px-3 py-4 align-top ' + (className ?? '')}>{children}</td>;
}

function VariantThumb({ urls }: { urls: string[] }) {
  const primary = urls[0];
  if (!primary) {
    return (
      <div className="grid size-12 place-items-center rounded-xs border border-rule bg-paper-2 text-ink-4">
        <ImageOff className="size-4" />
      </div>
    );
  }
  return (
    <div className="relative size-12 overflow-hidden rounded-xs border border-rule bg-paper-2">
      <img src={primary} alt="" className="size-full object-contain" loading="lazy" />
      {urls.length > 1 ? (
        <span className="absolute right-0.5 bottom-0.5 rounded-xs bg-ink/85 px-1 font-mono text-[10px] text-paper">
          +{urls.length - 1}
        </span>
      ) : null}
    </div>
  );
}

function CreateVariantDialog({
  open,
  onOpenChange,
  listingId,
  gallery,
  existingVariants,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listingId: string;
  gallery: string[];
  existingVariants: Variant[];
  onCreated: () => void;
}) {
  // ── Local state ──────────────────────────────────────────
  // Shopify-style options builder. Empty = "no options" (single-variant product).
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [labelOverride, setLabelOverride] = useState<string | null>(null);
  const [sku, setSku] = useState('');
  const [pricePaise, setPricePaise] = useState('99900');
  const [stock, setStock] = useState('0');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reset on close so reopening gives a fresh form.
  useEffect(() => {
    if (open) return;
    setOptions([]);
    setLabelOverride(null);
    setSku('');
    setPricePaise('99900');
    setStock('0');
    setImageUrls([]);
    setError(null);
  }, [open]);

  // Suggested option names from existing variants — when this listing already has
  // "Size" and "Color" variants, the new dialog can suggest those keys as datalist.
  const suggestedOptionNames = useMemo(() => {
    const names = new Set<string>();
    for (const v of existingVariants) {
      for (const k of Object.keys(v.attributes)) names.add(capitalise(k));
    }
    return Array.from(names);
  }, [existingVariants]);

  const autoLabel = labelFromOptions(options);
  const displayLabel = labelOverride ?? autoLabel;

  // ── Mutation ────────────────────────────────────────────
  const create = useMutation({
    mutationFn: () =>
      api<Variant>(`/retailer/listings/${listingId}/variants`, {
        method: 'POST',
        body: {
          attributesLabel: displayLabel,
          attributes: attrsFromOptions(options),
          ...(sku.trim() ? { sku: sku.trim() } : {}),
          pricePaise: parseInt(pricePaise, 10),
          stock: parseInt(stock, 10),
          imageUrls,
        },
      }),
    onSuccess: () => {
      toast.success('Variant added');
      onOpenChange(false);
      onCreated();
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'sku_taken'
          ? 'That SKU is already used on another variant of this product.'
          : e instanceof Error
            ? e.message
            : 'Could not add variant',
      );
    },
  });

  function handleAddOption() {
    setOptions((prev) => [...prev, { name: '', value: '' }]);
  }
  function handleRemoveOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }
  function handleUpdateOption(i: number, patch: Partial<OptionRow>) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
    setLabelOverride(null); // user is editing — let the auto-label re-flow
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Validate: every option row must have both name and value (or be removed)
    const incomplete = options.some(
      (o) => (o.name.trim() && !o.value.trim()) || (!o.name.trim() && o.value.trim()),
    );
    if (incomplete) {
      setError('Each option needs both a name and a value.');
      return;
    }
    // Duplicate option names are confusing
    const names = options.map((o) => o.name.trim().toLowerCase()).filter(Boolean);
    if (new Set(names).size !== names.length) {
      setError('Each option name must be unique.');
      return;
    }
    // Numeric checks
    const pricePaiseNum = parseInt(pricePaise, 10);
    const stockNum = parseInt(stock, 10);
    if (!Number.isFinite(pricePaiseNum) || pricePaiseNum < 1) {
      setError('Price must be at least 1 paisa.');
      return;
    }
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      setError('Stock must be 0 or more.');
      return;
    }
    create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add variant</DialogTitle>
          <DialogDescription>
            Define options like Size or Colour, set price &amp; stock, and add images. Skip
            options entirely for single-variant products.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Options builder */}
          <section>
            <div className="flex items-end justify-between mb-2">
              <Label hint={options.length === 0 ? 'optional — skip for single-variant products' : undefined}>
                Options
              </Label>
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">
                {options.length} option{options.length === 1 ? '' : 's'}
              </span>
            </div>

            {options.length > 0 && (
              <ul className="space-y-2 mb-2">
                {options.map((opt, i) => (
                  <li key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Input
                        list="variant-option-names"
                        placeholder="Name (e.g. Size)"
                        value={opt.name}
                        onChange={(e) => handleUpdateOption(i, { name: e.target.value })}
                      />
                    </div>
                    <div className="col-span-6">
                      <Input
                        placeholder="Value (e.g. M)"
                        value={opt.value}
                        onChange={(e) => handleUpdateOption(i, { value: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(i)}
                        className="grid h-9 w-full place-items-center text-ink-3 hover:text-danger"
                        aria-label={`Remove option ${i + 1}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {/* Datalist of existing option names — gives autosuggest in the inputs above */}
            {suggestedOptionNames.length > 0 && (
              <datalist id="variant-option-names">
                {suggestedOptionNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            )}

            <button
              type="button"
              onClick={handleAddOption}
              className="text-[12px] uppercase tracking-[0.14em] text-ink-2 hover:text-ink"
            >
              + Add option
            </button>
          </section>

          {/* Display label — auto-generated from options, editable */}
          <section>
            <Label htmlFor="vLabel" hint="auto-filled from options · editable">
              Display label
            </Label>
            <Input
              id="vLabel"
              value={displayLabel}
              onChange={(e) => setLabelOverride(e.target.value)}
            />
            <p className="mt-1 text-[11.5px] text-ink-3">
              Shown to customers (e.g. <span className="text-ink">{autoLabel}</span>).
            </p>
          </section>

          {/* Pricing & inventory */}
          <section>
            <div className="kicker mb-2 text-ink-3">Pricing &amp; inventory</div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <Label htmlFor="vSku" hint="Optional">SKU</Label>
                <Input
                  id="vSku"
                  mono
                  placeholder="e.g. LIN-M-BLK"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  className="uppercase"
                />
              </div>
              <div>
                <Label htmlFor="vPrice" required hint="paise">Price</Label>
                <Input
                  id="vPrice"
                  mono
                  type="number"
                  min={1}
                  value={pricePaise}
                  onChange={(e) => setPricePaise(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="vStock" required>Stock</Label>
                <Input
                  id="vStock"
                  mono
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Per-variant images — picked from the listing's media library, not uploaded
              separately. Uploads happen on the Details tab; this dialog just selects. */}
          <section>
            <div className="kicker mb-2 text-ink-3">Images</div>
            <VariantImagePicker
              gallery={gallery}
              selected={imageUrls}
              onChange={setImageUrls}
            />
          </section>

          <FieldError>{error}</FieldError>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={create.isPending}>Add variant</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function capitalise(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function EditInventoryDialog({
  target,
  gallery,
  onClose,
  onSaved,
}: {
  target: Variant | null;
  gallery: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(InventoryPatchSchema),
    defaultValues: { pricePaise: 0, stock: 0, sku: '' },
    ...(target
      ? { values: { pricePaise: target.pricePaise, stock: target.stock, sku: target.sku ?? '' } }
      : {}),
  });

  // RHF's register hands us its own onChange — wrap it so the SKU uppercases as the
  // user types. Saved values match the displayed value, so the API and the cell render
  // both see "lin-01" → "LIN-01".
  const skuField = register('sku');

  // Image gallery is managed independently of the form fields — every change PATCHes
  // the variant immediately so the user can add/remove without hitting Save.
  const [imageUrls, setImageUrls] = useState<string[]>(target?.imageUrls ?? []);
  useEffect(() => {
    setImageUrls(target?.imageUrls ?? []);
  }, [target]);

  const save = useMutation({
    mutationFn: (v: InventoryPatchValues) =>
      api<Variant>(`/retailer/variants/${target!.id}`, {
        method: 'PATCH',
        body: {
          pricePaise: v.pricePaise,
          stock: v.stock,
          ...(v.sku ? { sku: v.sku } : {}),
          imageUrls,
        },
      }),
    onSuccess: () => {
      toast.success('Variant updated');
      onClose();
      reset();
      onSaved();
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'sku_taken'
          ? 'That SKU collides with another variant.'
          : code === 'invalid_state'
            ? (e instanceof ApiError && e.message) || 'Cannot lower stock below reserved'
            : e instanceof Error
              ? e.message
              : 'Could not save',
      );
    },
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {target?.attributesLabel}</DialogTitle>
          <DialogDescription>Update price, stock, SKU, or images.</DialogDescription>
        </DialogHeader>
        {target && (
          <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-6" noValidate>
            <div>
              <div className="kicker mb-2 text-ink-3">Pricing &amp; inventory</div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <Label htmlFor="ePrice" required hint="paise">Price</Label>
                  <Input id="ePrice" mono type="number" min={1} {...register('pricePaise')} />
                  <FieldError>{errors.pricePaise?.message}</FieldError>
                </div>
                <div>
                  <Label htmlFor="eStock" required>Stock</Label>
                  <Input id="eStock" mono type="number" min={0} {...register('stock')} />
                  <FieldError>{errors.stock?.message}</FieldError>
                </div>
                <div>
                  <Label htmlFor="eSku">SKU</Label>
                  <Input
                    id="eSku"
                    mono
                    className="uppercase"
                    {...skuField}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      setValue('sku', e.target.value, { shouldDirty: true, shouldValidate: true });
                    }}
                  />
                  <FieldError>{errors.sku?.message}</FieldError>
                </div>
              </div>
              <p className="mt-2 text-[11.5px] uppercase tracking-[0.14em] text-ink-3">
                Currently reserved: <span className="text-ink font-mono normal-case">{target.reserved}</span>. New stock must be ≥ this.
              </p>
            </div>

            <div>
              <div className="kicker mb-2 text-ink-3">Images</div>
              <VariantImagePicker
                gallery={gallery}
                selected={imageUrls}
                onChange={setImageUrls}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="ink" caps loading={isSubmitting || save.isPending} iconLeft={<Save className="size-3.5" />}>
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

const DetailsPatchSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().or(z.literal('').transform(() => undefined)),
  badge: z.enum(['new', 'hot', 'trending', 'none']),
  listingPolicy: z.enum(['return', 'replace', 'final_sale']),
  status: z.enum(['draft', 'active', 'retired']),
});
type DetailsPatchValues = z.infer<typeof DetailsPatchSchema>;

function DetailsTab({ listing, onChanged }: { listing: Listing; onChanged: () => void }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(DetailsPatchSchema),
    defaultValues: {
      name: listing.name,
      description: listing.description ?? '',
      badge: listing.badge,
      listingPolicy: listing.listingPolicy,
      status: listing.status,
    },
  });

  const save = useMutation({
    mutationFn: (v: DetailsPatchValues) =>
      api<Listing>(`/retailer/listings/${listing.id}`, { method: 'PATCH', body: v }),
    onSuccess: () => {
      toast.success('Saved');
      onChanged();
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'store_not_active'
          ? 'Store needs to be active to publish.'
          : e instanceof Error
            ? e.message
            : 'Save failed',
      );
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate(v))}
      className="grid gap-12 lg:grid-cols-12"
    >
      <section className="lg:col-span-7 space-y-7">
        <SectionHeading title="Product info" />
        <div>
          <Label htmlFor="dName" required>Name</Label>
          <Input id="dName" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="dDesc" hint="Optional">Description</Label>
          <Textarea id="dDesc" rows={6} {...register('description')} />
          <FieldError>{errors.description?.message}</FieldError>
        </div>
      </section>

      <section className="lg:col-span-5 space-y-7">
        <SectionHeading title="Metadata" />
        <div>
          <Label hint="Publish via the panel above">Status</Label>
          <Select
            value={watch('status') === 'active' ? 'active' : watch('status')}
            onValueChange={(v) => setValue('status', v as DetailsPatchValues['status'])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              {watch('status') === 'active' && <SelectItem value="active">Active</SelectItem>}
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Badge</Label>
          <Select value={watch('badge')} onValueChange={(v) => setValue('badge', v as DetailsPatchValues['badge'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="hot">Hot</SelectItem>
              <SelectItem value="trending">Trending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Return policy</Label>
          <Select
            value={watch('listingPolicy')}
            onValueChange={(v) => setValue('listingPolicy', v as DetailsPatchValues['listingPolicy'])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="return">Returnable</SelectItem>
              <SelectItem value="replace">Replace only</SelectItem>
              <SelectItem value="final_sale">Final sale</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <div className="lg:col-span-12 flex items-center justify-end gap-2 border-t border-rule pt-6">
        <Button
          type="submit"
          variant="ink"
          caps
          loading={isSubmitting || save.isPending}
          iconLeft={<Save className="size-3.5" />}
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}

/**
 * Publish-readiness panel — shown above the tabs on the listing detail page.
 *  - Mirrors the backend gate exactly: at least one variant + at least one gallery image
 *  - Owns the Publish action (so it can run readiness checks BEFORE the API hop)
 *  - Owns gallery-URL management (paste any image URL, no upload pipeline yet)
 *  - Once published, switches to a compact "Published" header with an Unpublish action
 */
function PublishPanel({ listing, onChanged }: { listing: Listing; onChanged: () => void }) {
  const variants = listing.variants ?? [];
  const images = listing.galleryUrls ?? [];
  const hasVariants = variants.length > 0;
  const hasImages = images.length > 0;
  const ready = hasVariants && hasImages;
  const isPublished = listing.status === 'active';

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Listing>(`/retailer/listings/${listing.id}`, { method: 'PATCH', body }),
    onSuccess: () => onChanged(),
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      const msg =
        code === 'cannot_publish_incomplete'
          ? e instanceof ApiError ? e.message : 'Cannot publish — listing is incomplete.'
          : code === 'store_not_active'
            ? 'Your store is not active.'
            : code === 'retailer_not_approved'
              ? 'Your account needs admin approval first.'
              : e instanceof Error
                ? e.message
                : 'Update failed.';
      toast.error(msg);
    },
  });

  function publish() {
    patch.mutate({ status: 'active' });
  }

  function unpublish() {
    patch.mutate({ status: 'draft' });
  }

  return (
    <section className="mb-8 border border-rule bg-surface p-5 sm:p-6 rounded-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="kicker text-ink-3">Publish status</div>
          <h2 className="font-display italic text-[22px] sm:text-[24px] leading-tight mt-1">
            {isPublished ? <>This product is <em>live</em>.</> : <>Get this product ready to publish.</>}
          </h2>
        </div>
        {isPublished ? (
          <Button
            variant="outline"
            size="sm"
            onClick={unpublish}
            loading={patch.isPending && (patch.variables as { status?: string } | undefined)?.status === 'draft'}
          >
            Unpublish (back to draft)
          </Button>
        ) : (
          <Button
            variant="ink"
            caps
            size="sm"
            disabled={!ready}
            loading={patch.isPending && (patch.variables as { status?: string } | undefined)?.status === 'active'}
            iconLeft={<Check className="size-3.5" />}
            onClick={publish}
            title={!ready ? 'Add at least one variant and one image to publish' : undefined}
          >
            Publish
          </Button>
        )}
      </div>

      {/* Readiness checklist — only shown while drafting */}
      {!isPublished && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ReadyItem
            ok={hasVariants}
            label="At least one variant"
            detail={
              hasVariants
                ? `${variants.length} on file (price + stock set)`
                : 'Add a variant in the tab below — it carries SKU, price, and stock.'
            }
          />
          <ReadyItem
            ok={hasImages}
            label="At least one image"
            detail={
              hasImages
                ? `${images.length} on file · drag in the gallery below to reorder`
                : 'Drop a file in the gallery below — crop, then we host it on the CDN.'
            }
          />
        </div>
      )}

      {/* Full media gallery — drag/drop, crop, sortable preview, URL fallback */}
      <div className="mt-6 border-t border-rule pt-5">
        <MediaGallery
          urls={images}
          uploadFolder={`products/${listing.id}`}
          busy={patch.isPending}
          onChange={(next) => patch.mutate({ galleryUrls: next })}
        />
      </div>
    </section>
  );
}

function ReadyItem({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 border border-rule rounded-xs px-3 py-2.5">
      <span
        className={
          ok
            ? 'mt-0.5 grid size-5 place-items-center rounded-full bg-success-soft text-success'
            : 'mt-0.5 grid size-5 place-items-center rounded-full bg-warning-soft text-warning'
        }
        aria-hidden
      >
        {ok ? <Check className="size-3" /> : <span className="size-1.5 bg-warning rounded-full" />}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-[12px] text-ink-3">{detail}</div>
      </div>
    </div>
  );
}

