import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, ImageOff, Plus, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { canPublishProducts, deriveGate } from '@/lib/gate';
import { listingStatusMeta } from '@/lib/status';
import type { AttributeTemplate, Brand, Category, Listing, ListingStatus, RetailerProfile, Store } from '@/lib/types';
import { GateNotice } from '@/components/retailer/gate-notice';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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

const STATUS_OPTIONS: ReadonlyArray<{ value: ListingStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All products' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'retired', label: 'Retired' },
];

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  brandId: z.string().min(1, 'Pick a brand'),
  categoryId: z.string().min(1, 'Pick a category'),
  gender: z.enum(['her', 'him', 'unisex']),
  badge: z.enum(['new', 'hot', 'trending', 'none']).default('none'),
  listingPolicy: z.enum(['return', 'replace', 'final_sale']).default('return'),
  hsn: z.string().trim().max(8).optional(),
  templateId: z.string().optional(),
  // No status here — every new listing starts as `draft`. The retailer publishes
  // (status='active') from the detail page after adding variants and images.
});
type CreateValues = z.infer<typeof CreateSchema>;

type MeResponse = { retailer: RetailerProfile; store: Store | null };

export default function RetailerListings() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ListingStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drives the gate banner. Only mutations on this page are gated server-side, but
  // we mirror the rule client-side so the user knows in advance.
  const me = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });
  const gate = deriveGate(me.data?.retailer, me.data?.store);
  const canPublish = canPublishProducts(gate);

  const qc = useQueryClient();
  const bulkStatus = useMutation({
    mutationFn: (body: { ids: string[]; status: 'active' | 'draft' }) =>
      api<{ updated: number; skipped: number }>('/retailer/listings/bulk-status', { method: 'POST', body }),
    onSuccess: (data) => {
      toast.success(`Updated ${data.updated} product${data.updated === 1 ? '' : 's'}${data.skipped > 0 ? ` · ${data.skipped} skipped` : ''}`);
      setSelected(new Set());
      setBulkMode(false);
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Bulk update failed'),
  });

  const listings = useQuery({
    queryKey: ['retailer', 'listings', status],
    queryFn: () =>
      api<Listing[]>(status === 'all' ? '/retailer/listings' : `/retailer/listings?status=${status}`),
    enabled: canPublish,
  });

  const filtered = (listings.data ?? []).filter((l) => {
    if (!q.trim()) return true;
    const n = q.toLowerCase();
    return l.name.toLowerCase().includes(n) || (l.brand?.name.toLowerCase().includes(n) ?? false);
  });

  return (
    <Page>
      <PageHeader
        title={<>Products</>}
        description={
          <>
            Each row is a product. Variants (size, colour, SKU, stock) live inside each
            one — open it to manage them.
          </>
        }
        actions={
          canPublish ? (
            <div className="flex items-center gap-2">
              <Button
                variant={bulkMode ? 'ink' : 'outline'}
                size="sm"
                onClick={() => {
                  setBulkMode((b) => !b);
                  setSelected(new Set());
                }}
              >
                {bulkMode ? 'Exit bulk mode' : 'Bulk select'}
              </Button>
              <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
                New product
              </Button>
            </div>
          ) : undefined
        }
      />

      {!canPublish ? (
        <GateNotice gate={gate} />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Input
                placeholder="Search by name or brand…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="!pl-7"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="kicker text-ink-3 hidden sm:inline">Filter</span>
              <Select value={status} onValueChange={(v) => setStatus(v as ListingStatus | 'all')}>
                <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {listings.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-stagger>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : listings.isError ? (
            <Empty
              kicker="Connection lost"
              title="Couldn't load products."
              description={listings.error instanceof ApiError ? listings.error.message : 'Try again.'}
              action={<Button variant="outline" onClick={() => listings.refetch()}>Retry</Button>}
            />
          ) : filtered.length === 0 ? (
            <Empty
              kicker={q ? 'No matches' : 'No products yet'}
              title={q ? 'Nothing matches that search.' : 'No products yet.'}
              description={
                q
                  ? 'Try a different keyword or clear the filter.'
                  : 'Add your first product to begin selling.'
              }
              action={
                !q && (
                  <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
                    Add product
                  </Button>
                )
              }
            />
          ) : (
            <>
              {bulkMode && (
                <div className="mb-3 flex items-center justify-between rounded-md border border-line bg-bg-2/40 px-3 py-2 text-[12.5px]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(filtered.map((l) => l.id)) : new Set())
                      }
                      className="size-4 cursor-pointer accent-accent"
                    />
                    <span className="text-ink-2">{selected.size} of {filtered.length} selected</span>
                  </label>
                </div>
              )}
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-stagger>
                {filtered.map((l, i) => (
                  <li key={l.id} className="relative">
                    {bulkMode && (
                      <label className="absolute left-2 top-2 z-10 grid size-7 place-items-center rounded-md bg-bg/95 backdrop-blur shadow-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.has(l.id)}
                          onChange={(e) => {
                            setSelected((s) => {
                              const next = new Set(s);
                              if (e.target.checked) next.add(l.id);
                              else next.delete(l.id);
                              return next;
                            });
                          }}
                          className="size-4 cursor-pointer accent-accent"
                        />
                      </label>
                    )}
                    <ListingCard listing={l} ord={i + 1} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {bulkMode && selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          ids={[...selected]}
          onActivate={() => bulkStatus.mutate({ ids: [...selected], status: 'active' })}
          onDraft={() => bulkStatus.mutate({ ids: [...selected], status: 'draft' })}
          pending={bulkStatus.isPending}
        />
      )}

      <CreateDialog open={open} onOpenChange={setOpen} />
    </Page>
  );
}

function BulkActionBar({ count, ids: _ids, onActivate, onDraft, pending }: { count: number; ids: string[]; onActivate: () => void; onDraft: () => void; pending?: boolean }) {
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-line bg-bg/95 backdrop-blur px-3 py-2 shadow-lg flex items-center gap-2">
      <span className="text-[12.5px] text-ink-2 px-2">{count} selected</span>
      <Button size="sm" variant="outline" disabled={pending} onClick={onDraft}>Move to draft</Button>
      <Button size="sm" variant="accent" loading={pending ?? false} onClick={onActivate}>Make active</Button>
    </div>
  );
}

function ListingCard({ listing, ord }: { listing: Listing; ord: number }) {
  const meta = listingStatusMeta(listing.status);
  const variantCount = listing.variants?.length ?? 0;
  const totalStock = listing.variants?.reduce((acc, v) => acc + v.stock, 0) ?? 0;
  // Hero precedence: listing gallery → first variant's first image → placeholder.
  // Variants are the per-colour shots, so they're a much better fallback than empty
  // when the retailer has only uploaded variant photos.
  const hero =
    listing.galleryUrls?.[0] ??
    listing.variants?.find((v) => v.imageUrls && v.imageUrls.length > 0)?.imageUrls[0] ??
    null;
  return (
    <Link
      to={`/retailer/listings/${listing.id}`}
      className="group block focus-visible:outline-none"
    >
      <article className="relative flex h-full gap-3 overflow-hidden border border-rule bg-surface p-3 transition-colors hover:border-ink hover:bg-paper press">
        {/* Square thumb — small, fixed size; meta lives to the right. Whole card
            stays under ~120px tall so a row of cards is dense. */}
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xs border border-rule bg-paper-2">
          {hero ? (
            <img
              src={hero}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="grid size-full place-items-center text-ink-4">
              <ImageOff className="size-5" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
              № {String(ord).padStart(3, '0')}
            </span>
            <ArrowUpRight className="size-3.5 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
          </div>

          <h3 className="mt-0.5 font-display italic text-[18px] leading-tight text-ink line-clamp-1">
            {listing.name}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {listing.badge !== 'none' && <Badge flat>{listing.badge}</Badge>}
          </div>

          <p className="mt-1.5 truncate text-[12px] text-ink-2">
            <span className={listing.brand?.name ? 'font-medium text-ink' : 'italic text-ink-3'}>
              {listing.brand?.name ?? 'Unbranded'}
            </span>
            <span className="mx-1.5 text-ink-4">·</span>
            {listing.category?.label ?? listing.categoryId}
            <span className="mx-1.5 text-ink-4">·</span>
            <span className="capitalize">{listing.gender}</span>
          </p>

          <div className="mt-auto flex items-baseline gap-4 pt-1.5 text-[11.5px]">
            <div>
              <span className="kicker text-ink-3">Variants </span>
              <span className="font-mono tabular-nums text-ink">{String(variantCount).padStart(2, '0')}</span>
            </div>
            <div>
              <span className="kicker text-ink-3">Stock </span>
              <span className="font-mono tabular-nums text-ink">{String(totalStock).padStart(3, '0')}</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

function CreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const brands = useQuery({ queryKey: ['catalog', 'brands'], queryFn: () => api<Brand[]>('/catalog/brands') });
  const categories = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => api<Category[]>('/catalog/categories'),
  });
  const templates = useQuery({
    queryKey: ['retailer', 'attribute-templates'],
    queryFn: () => api<AttributeTemplate[]>('/retailer/attribute-templates'),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(CreateSchema),
    defaultValues: {
      name: '',
      description: '',
      brandId: '',
      categoryId: '',
      gender: 'unisex',
      badge: 'none',
      listingPolicy: 'return',
      hsn: '',
      templateId: '',
    },
  });

  const create = useMutation({
    mutationFn: (v: CreateValues) =>
      api<Listing>('/retailer/listings', {
        method: 'POST',
        body: { ...v, galleryUrls: [], ...(v.templateId ? {} : { templateId: undefined }) },
      }),
    onSuccess: (l) => {
      toast.success(`Created · ${l.name}`, {
        description: 'Add variants and at least one image, then publish.',
      });
      onOpenChange(false);
      reset();
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
      // Take the retailer straight to the detail page where they'll add variants
      // and images — that's where publish happens.
      navigate(`/retailer/listings/${l.id}`);
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'retailer_not_approved'
          ? 'Your account needs admin approval first.'
          : code === 'store_not_active'
            ? 'Your store needs to be approved before publishing.'
            : e instanceof Error
              ? e.message
              : 'Could not create product',
      );
    },
  });

  const currentGender = watch('gender');
  const visibleCategories = useMemo(
    () => (categories.data ?? []).filter((c) => c.gender === currentGender || c.gender === 'unisex'),
    [categories.data, currentGender],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
          <DialogDescription>
            Add the product itself first; you'll add variants (size, colour, SKU, price) right after.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-5" noValidate>
          <div>
            <Label htmlFor="name" required>Name</Label>
            <Input id="name" placeholder="e.g. Linen relaxed shirt" {...register('name')} />
            <FieldError>{errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="description" hint="Optional">Description</Label>
            <Textarea id="description" placeholder="What makes it special…" {...register('description')} />
            <FieldError>{errors.description?.message}</FieldError>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label required>Cut for</Label>
              <Select value={currentGender} onValueChange={(v) => setValue('gender', v as 'her' | 'him' | 'unisex')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="her">Her</SelectItem>
                  <SelectItem value="him">Him</SelectItem>
                  <SelectItem value="unisex">Unisex</SelectItem>
                </SelectContent>
              </Select>
              <FieldError>{errors.gender?.message}</FieldError>
            </div>
            <div>
              <Label required>Brand</Label>
              <Select value={watch('brandId')} onValueChange={(v) => setValue('brandId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={brands.isLoading ? 'Loading…' : 'Pick a brand'} />
                </SelectTrigger>
                <SelectContent>
                  {(brands.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{errors.brandId?.message}</FieldError>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label required>Category</Label>
              <Select value={watch('categoryId')} onValueChange={(v) => setValue('categoryId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={categories.isLoading ? 'Loading…' : 'Pick a category'} />
                </SelectTrigger>
                <SelectContent>
                  {visibleCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label} · {c.gender}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{errors.categoryId?.message}</FieldError>
            </div>
            <div>
              <Label>Badge</Label>
              <Select value={watch('badge') ?? 'none'} onValueChange={(v) => setValue('badge', v as CreateValues['badge'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="trending">Trending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Return policy</Label>
              <Select value={watch('listingPolicy') ?? 'return'} onValueChange={(v) => setValue('listingPolicy', v as CreateValues['listingPolicy'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="return">Returnable</SelectItem>
                  <SelectItem value="replace">Replace only</SelectItem>
                  <SelectItem value="final_sale">Final sale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="hsn" hint="GST">HSN</Label>
              <Input id="hsn" mono placeholder="e.g. 6105" {...register('hsn')} />
              <FieldError>{errors.hsn?.message}</FieldError>
            </div>
          </div>
          {(templates.data ?? []).length > 0 && (
            <div>
              <Label hint="Optional — auto-fills variant axis names">Attribute template</Label>
              <Select
                value={watch('templateId') || '__none__'}
                onValueChange={(v) => setValue('templateId', v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No template — build manually" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No template</SelectItem>
                  {(templates.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.isPlatformDefault ? ' · platform default' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11.5px] text-ink-3">
                Templates pre-fill axis names (Size, Colour…) when you add variants.
              </p>
            </div>
          )}
          <div className="rounded-xs border border-rule bg-paper-2/50 px-3 py-2.5 text-[12.5px] text-ink-2 leading-relaxed">
            <span className="kicker text-ink-3 mr-2">Next</span>
            New products start as <em>draft</em>. Add variants (price + stock) and at least
            one image on the next screen, then publish.
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={isSubmitting || create.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
