import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ImageOff, Plus, Search } from 'lucide-react';
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
  name: z.string().trim().min(1, 'Required').max(200),
  description: z.string().trim().max(5000).optional(),
  brandId: z.string().min(1, 'Pick a brand'),
  categoryId: z.string().min(1, 'Pick a category'),
  gender: z.enum(['her', 'him', 'unisex']),
  badge: z.enum(['new', 'hot', 'trending', 'none']).default('none'),
  occasion: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  ageGroup: z.enum(['kids', 'teens', 'adults', 'all']).nullable().optional(),
  listingPolicy: z.enum(['return', 'replace', 'final_sale']).default('return'),
  hsn: z.string().trim().max(8).optional(),
  templateId: z.string().optional(),
  // No status here — every new listing starts as `draft`. The retailer publishes
  // (status='active') from the detail page after adding variants and images.
});
type CreateValues = z.infer<typeof CreateSchema>;

const WIZARD_STEPS = ['Basics', 'Tags', 'Template', 'Policy', 'Review'] as const;
const STEP_FIELDS: Record<number, (keyof CreateValues)[]> = {
  0: ['name', 'brandId', 'categoryId', 'gender'],
  1: ['description', 'badge', 'occasion', 'ageGroup'],
  2: ['templateId'],
  3: ['listingPolicy', 'hsn'],
  4: [],
};

const OCCASION_PRESETS = [
  'casual', 'formal', 'work', 'party', 'festive',
  'sports', 'ethnic', 'wedding', 'beach', 'lounge',
] as const;

const POLICY_LABEL: Record<CreateValues['listingPolicy'], string> = {
  return: 'Returnable',
  replace: 'Replace only',
  final_sale: 'Final sale',
};

const AGE_GROUP_LABEL: Record<NonNullable<CreateValues['ageGroup']>, string> = {
  kids: 'Kids',
  teens: 'Teens',
  adults: 'Adults',
  all: 'All ages',
};

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
    mutationFn: (body: { ids: string[]; status: 'active' | 'draft' | 'retired' }) =>
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
    queryFn: () => {
      const params = new URLSearchParams({ sort: 'updated_desc' });
      if (status !== 'all') params.set('status', status);
      return api<Listing[]>(`/retailer/listings?${params}`);
    },
    enabled: canPublish,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'active' | 'draft' }) =>
      api('/retailer/listings/bulk-status', { method: 'POST', body: { ids: [id], status: next } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] }),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const deleteListing = useMutation({
    mutationFn: (id: string) => api(`/retailer/listings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Listing deleted');
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
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
            <div className="overflow-hidden rounded border border-rule">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[52px] rounded-none" />)}
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
            <div className="overflow-hidden rounded border border-rule">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-rule bg-bg-2/60">
                    {bulkMode && (
                      <th className="w-10 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.size === filtered.length && filtered.length > 0}
                          onChange={(e) =>
                            setSelected(e.target.checked ? new Set(filtered.map((l) => l.id)) : new Set())
                          }
                          className="size-4 cursor-pointer accent-accent"
                        />
                      </th>
                    )}
                    <th className="w-14 py-2.5 pl-4 pr-2" />
                    <th className="py-2.5 pr-4 text-left kicker text-ink-3">Product</th>
                    <th className="py-2.5 pr-4 text-left kicker text-ink-3 w-28">Status</th>
                    <th className="py-2.5 pr-4 text-right kicker text-ink-3 w-20">Variants</th>
                    <th className="py-2.5 pr-4 text-right kicker text-ink-3 w-24">Stock</th>
                    <th className="w-36 py-2.5 pr-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {filtered.map((l) => (
                    <ListingRow
                      key={l.id}
                      listing={l}
                      bulkMode={bulkMode}
                      selected={selected.has(l.id)}
                      onSelectChange={(checked) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (checked) next.add(l.id);
                          else next.delete(l.id);
                          return next;
                        })
                      }
                      onToggleStatus={(next) => toggleStatus.mutate({ id: l.id, next })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {bulkMode && selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          ids={[...selected]}
          allDraft={[...selected].every((id) => filtered.find((l) => l.id === id)?.status === 'draft')}
          onActivate={() => bulkStatus.mutate({ ids: [...selected], status: 'active' })}
          onDraft={() => bulkStatus.mutate({ ids: [...selected], status: 'draft' })}
          onArchive={() => bulkStatus.mutate({ ids: [...selected], status: 'retired' })}
          onDelete={() => {
            if (!window.confirm('Delete all selected draft listings? This cannot be undone.')) return;
            Promise.all([...selected].map((id) => deleteListing.mutateAsync(id))).catch(() => null);
          }}
          pending={bulkStatus.isPending || deleteListing.isPending}
        />
      )}

      <CreateDialog open={open} onOpenChange={setOpen} />
    </Page>
  );
}

function BulkActionBar({ count, ids: _ids, allDraft, onActivate, onDraft, onArchive: _onArchive, onDelete, pending }: {
  count: number; ids: string[]; allDraft: boolean;
  onActivate: () => void; onDraft: () => void; onArchive: () => void; onDelete: () => void; pending?: boolean;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-line bg-bg/95 backdrop-blur px-3 py-2 shadow-lg flex items-center gap-2">
      <span className="text-[12.5px] text-ink-2 px-2">{count} selected</span>
      <Button size="sm" variant="outline" disabled={pending} onClick={onDraft}>Move to draft</Button>
      <Button size="sm" variant="accent" loading={pending ?? false} onClick={onActivate}>Make active</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => _onArchive()}>Archive</Button>
      {allDraft && (
        <Button size="sm" variant="danger" disabled={pending} onClick={onDelete}>Delete</Button>
      )}
    </div>
  );
}

function ListingRow({ listing, bulkMode, selected, onSelectChange, onToggleStatus }: {
  listing: Listing;
  bulkMode: boolean;
  selected: boolean;
  onSelectChange: (checked: boolean) => void;
  onToggleStatus?: (next: 'active' | 'draft') => void;
}) {
  const navigate = useNavigate();
  const meta = listingStatusMeta(listing.status);
  const variantCount = listing.variants?.length ?? 0;
  const totalStock = listing.variants?.reduce((acc, v) => acc + v.stock, 0) ?? 0;
  const hero =
    listing.galleryUrls?.[0] ??
    listing.variants?.find((v) => v.imageUrls && v.imageUrls.length > 0)?.imageUrls[0] ??
    null;

  return (
    <tr
      className={`group cursor-pointer transition-colors ${selected ? 'bg-accent/5' : 'hover:bg-bg-2/40'}`}
      onClick={() => navigate(`/retailer/listings/${listing.id}`)}
    >
      {bulkMode && (
        <td className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelectChange(e.target.checked)}
            className="size-4 cursor-pointer accent-accent"
          />
        </td>
      )}
      <td className="w-14 py-2 pl-4 pr-2">
        <div className="size-9 overflow-hidden rounded-xs border border-rule bg-paper-2 shrink-0">
          {hero ? (
            <img
              src={hero}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid size-full place-items-center text-ink-4">
              <ImageOff className="size-3.5" />
            </div>
          )}
        </div>
      </td>
      <td className="py-2 pr-4">
        <div className="flex flex-col">
          <span className="font-display italic text-[15px] leading-snug text-ink truncate max-w-xs">
            {listing.name}
          </span>
          <span className="mt-0.5 text-[11px] text-ink-3 truncate">
            <span className="font-medium text-ink-2">{listing.brand?.name ?? 'Unbranded'}</span>
            {' · '}{listing.category?.label ?? listing.categoryId}
            {' · '}<span className="capitalize">{listing.gender}</span>
            {listing.badge !== 'none' && (
              <>{' · '}<span className="capitalize text-accent">{listing.badge}</span></>
            )}
          </span>
        </div>
      </td>
      <td className="py-2 pr-4 w-28">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {listing.status === 'taken_down' && listing.takedownReason && (
          <div className="mt-1 text-[11px] text-warning truncate max-w-[14rem]" title={listing.takedownReason}>
            {listing.takedownReason}
          </div>
        )}
      </td>
      <td className="py-2 pr-4 w-20 text-right">
        <span className="font-mono tabular-nums text-[12.5px] text-ink">{String(variantCount).padStart(2, '0')}</span>
      </td>
      <td className="py-2 pr-4 w-24 text-right">
        <span className="font-mono tabular-nums text-[12.5px] text-ink">{String(totalStock).padStart(3, '0')}</span>
      </td>
      <td className="py-2 pr-4 w-36 text-right">
        <div className="flex items-center justify-end gap-2">
          {onToggleStatus && (listing.status === 'active' || listing.status === 'draft') && (
            <Button
              size="sm"
              variant={listing.status === 'active' ? 'outline' : 'accent'}
              onClick={(e) => {
                e.stopPropagation();
                const next = listing.status === 'active' ? 'draft' : 'active';
                if (next === 'active') {
                  const missing: string[] = [];
                  if (!listing.variants?.length) missing.push('at least one variant');
                  if (!listing.galleryUrls?.length) missing.push('at least one image');
                  if (missing.length > 0) {
                    toast.error(`Can't publish — add ${missing.join(' and ')} first. Open product to add.`);
                    return;
                  }
                }
                onToggleStatus(next);
              }}
            >
              {listing.status === 'active' ? 'Unpublish' : 'Publish'}
            </Button>
          )}
          <ArrowUpRight className="size-3.5 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </td>
    </tr>
  );
}

function CreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const brands = useQuery({ queryKey: ['catalog', 'brands'], queryFn: () => api<Brand[]>('/catalog/brands') });
  const categories = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => api<Category[]>('/catalog/categories'),
  });
  const templates = useQuery({
    queryKey: ['retailer', 'attribute-templates'],
    queryFn: () => api<AttributeTemplate[]>('/retailer/attribute-templates'),
  });

  const form = useForm({
    resolver: zodResolver(CreateSchema),
    defaultValues: {
      name: '',
      description: '',
      brandId: '',
      categoryId: '',
      gender: 'unisex' as const,
      badge: 'none' as const,
      occasion: [] as string[],
      ageGroup: null as CreateValues['ageGroup'],
      listingPolicy: 'return' as const,
      hsn: '',
      templateId: '',
    },
  });
  const { register, handleSubmit, setValue, watch, reset, trigger, formState: { errors } } = form;

  function fullReset() {
    reset();
    setStep(0);
  }

  const create = useMutation({
    mutationFn: (v: CreateValues) =>
      api<Listing>('/retailer/listings', {
        method: 'POST',
        body: {
          ...v,
          galleryUrls: [],
          ...(v.templateId ? {} : { templateId: undefined }),
          ageGroup: v.ageGroup ?? null,
        },
      }),
    onSuccess: (l) => {
      toast.success(`Created · ${l.name}`, {
        description: 'Add variants and at least one image, then publish.',
      });
      onOpenChange(false);
      fullReset();
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
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

  // Filter templates by selected category (US-5.2.2). A template either targets a
  // specific category or applies platform-wide — both are shown when relevant.
  const selectedCategoryId = watch('categoryId');
  const visibleTemplates = useMemo(() => {
    const all = templates.data ?? [];
    if (!selectedCategoryId) return all;
    return all.filter((t) => {
      const tplAny = t as AttributeTemplate & { categoryId?: string | null };
      return !tplAny.categoryId || tplAny.categoryId === selectedCategoryId;
    });
  }, [templates.data, selectedCategoryId]);

  async function goNext() {
    const fields = STEP_FIELDS[step] ?? [];
    const valid = fields.length === 0 ? true : await trigger(fields);
    if (valid) setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }
  function jumpTo(target: number) {
    // Backward jumps are always free; forward jumps still validate intermediate steps.
    if (target <= step) setStep(target);
  }

  const values = watch();
  const brandLabel = brands.data?.find((b) => b.id === values.brandId)?.name ?? '—';
  const categoryLabel = categories.data?.find((c) => c.id === values.categoryId)?.label ?? '—';
  const templateLabel = templates.data?.find((t) => t.id === values.templateId)?.name ?? 'No template';

  const isLast = step === WIZARD_STEPS.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) fullReset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>New product · {WIZARD_STEPS[step]}</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {WIZARD_STEPS.length} — set the basics here; variants and gallery come next on the listing page.
          </DialogDescription>
        </DialogHeader>

        <WizardStepIndicator step={step} onJump={jumpTo} />

        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-5" noValidate>
          {/* Step 1 — Basics */}
          {step === 0 && (
            <>
              <div>
                <Label htmlFor="name" required>Name</Label>
                <Input id="name" placeholder="e.g. Linen relaxed shirt" {...register('name')} />
                <FieldError>{errors.name?.message}</FieldError>
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
                  <Select value={watch('brandId')} onValueChange={(v) => setValue('brandId', v, { shouldValidate: true })}>
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
              <div>
                <Label required>Category</Label>
                <Select
                  value={watch('categoryId')}
                  onValueChange={(v) => {
                    setValue('categoryId', v, { shouldValidate: true });
                    // Drop template when switching to a category it doesn't apply to.
                    const tpl = templates.data?.find((t) => t.id === watch('templateId'));
                    const tplAny = tpl as (AttributeTemplate & { categoryId?: string | null }) | undefined;
                    if (tpl && tplAny?.categoryId && tplAny.categoryId !== v) {
                      setValue('templateId', '');
                    }
                  }}
                >
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
            </>
          )}

          {/* Step 2 — Tags & description */}
          {step === 1 && (
            <>
              <div>
                <Label htmlFor="description" hint="Optional">Description</Label>
                <Textarea id="description" placeholder="What makes it special…" {...register('description')} />
                <FieldError>{errors.description?.message}</FieldError>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label hint="Optional">Badge</Label>
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
                <div>
                  <Label hint="Optional">Age group</Label>
                  <Select
                    value={watch('ageGroup') ?? '__none__'}
                    onValueChange={(v) => setValue('ageGroup', v === '__none__' ? null : (v as NonNullable<CreateValues['ageGroup']>))}
                  >
                    <SelectTrigger><SelectValue placeholder="Unspecified" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unspecified</SelectItem>
                      <SelectItem value="kids">Kids</SelectItem>
                      <SelectItem value="teens">Teens</SelectItem>
                      <SelectItem value="adults">Adults</SelectItem>
                      <SelectItem value="all">All ages</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label hint="Optional · multi-select">Occasion tags</Label>
                <OccasionChipPicker
                  value={watch('occasion') ?? []}
                  onChange={(next) => setValue('occasion', next, { shouldValidate: true })}
                />
                <FieldError>{errors.occasion?.message}</FieldError>
              </div>
            </>
          )}

          {/* Step 3 — Template */}
          {step === 2 && (
            <>
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
                    {visibleTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.isPlatformDefault ? ' · platform default' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11.5px] text-ink-3">
                  {visibleTemplates.length === 0 ? (
                    <>
                      No templates for this category yet.{' '}
                      <a
                        className="underline"
                        href="/retailer/attribute-templates"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open template editor
                      </a>{' '}
                      to create one — variants here will let you build axes manually.
                    </>
                  ) : (
                    <>
                      Showing {visibleTemplates.length} template{visibleTemplates.length === 1 ? '' : 's'} for{' '}
                      <em>{categoryLabel}</em>. The template locks once you add variants.
                    </>
                  )}
                </p>
              </div>
              <div className="rounded-xs border border-rule bg-paper-2/40 px-3 py-2.5 text-[12.5px] text-ink-2 leading-relaxed">
                Don't see a fit?{' '}
                <a className="underline" href="/retailer/attribute-templates" target="_blank" rel="noreferrer">
                  Open template editor in a new tab
                </a>{' '}
                — when you come back, the new one will appear in this list.
              </div>
            </>
          )}

          {/* Step 4 — Policy */}
          {step === 3 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label required>Return policy</Label>
                  <Select
                    value={watch('listingPolicy') ?? 'return'}
                    onValueChange={(v) => setValue('listingPolicy', v as CreateValues['listingPolicy'])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="return">Returnable</SelectItem>
                      <SelectItem value="replace">Replace only</SelectItem>
                      <SelectItem value="final_sale">Final sale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hsn" hint="GST">HSN code</Label>
                  <Input id="hsn" mono placeholder="e.g. 6105" {...register('hsn')} />
                  <FieldError>{errors.hsn?.message}</FieldError>
                </div>
              </div>
              <div className="rounded-xs border border-rule bg-paper-2/40 px-3 py-3 text-[12.5px] text-ink-2 leading-relaxed">
                Policy explained:
                <ul className="mt-1.5 list-disc pl-5 space-y-0.5">
                  <li><strong>Returnable</strong> — buyer can return for a refund within the platform window.</li>
                  <li><strong>Replace only</strong> — exchange for the same SKU; no cash refund.</li>
                  <li><strong>Final sale</strong> — non-returnable. Use sparingly to keep trust high.</li>
                </ul>
              </div>
            </>
          )}

          {/* Step 5 — Review */}
          {step === 4 && (
            <ReviewSummary
              values={values}
              brandLabel={brandLabel}
              categoryLabel={categoryLabel}
              templateLabel={templateLabel}
              onEdit={jumpTo}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <div className="flex-1" />
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                iconLeft={<ArrowLeft className="size-3.5" />}
                onClick={goBack}
              >
                Back
              </Button>
            )}
            {!isLast ? (
              <Button
                type="button"
                variant="ink"
                iconRight={<ArrowRight className="size-3.5" />}
                onClick={goNext}
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                variant="ink"
                caps
                loading={create.isPending}
              >
                Create draft
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WizardStepIndicator({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <nav aria-label="Wizard steps" className="mb-1 flex items-center gap-1.5 overflow-x-auto pb-2">
      {WIZARD_STEPS.map((label, i) => {
        const state = i < step ? 'done' : i === step ? 'active' : 'pending';
        const reachable = i <= step;
        return (
          <button
            key={label}
            type="button"
            disabled={!reachable}
            onClick={() => onJump(i)}
            className={
              'group flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] transition-colors ' +
              (state === 'active'
                ? 'border-ink bg-ink text-bg'
                : state === 'done'
                  ? 'border-line bg-bg text-ink-2 hover:border-line-2 cursor-pointer'
                  : 'border-line bg-bg-2 text-ink-4 cursor-not-allowed')
            }
          >
            <span
              className={
                'grid size-4 place-items-center rounded-full text-[10px] font-mono ' +
                (state === 'active' ? 'bg-bg text-ink' : state === 'done' ? 'bg-accent text-accent-fg' : 'bg-bg-3 text-ink-4')
              }
            >
              {state === 'done' ? <Check className="size-2.5" /> : i + 1}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function OccasionChipPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (occ: string) => {
    const has = value.includes(occ);
    if (has) onChange(value.filter((v) => v !== occ));
    else if (value.length < 10) onChange([...value, occ]);
    else toast.error('At most 10 occasions allowed');
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {OCCASION_PRESETS.map((occ) => {
        const selected = value.includes(occ);
        return (
          <button
            key={occ}
            type="button"
            onClick={() => toggle(occ)}
            className={
              'rounded-full border px-3 py-1 text-[12px] capitalize transition-colors ' +
              (selected
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-line bg-bg text-ink-2 hover:border-line-2')
            }
          >
            {occ}
          </button>
        );
      })}
    </div>
  );
}

type WizardSnapshot = {
  name?: string | undefined;
  description?: string | undefined;
  brandId?: string | undefined;
  categoryId?: string | undefined;
  gender?: CreateValues['gender'] | undefined;
  badge?: CreateValues['badge'] | undefined;
  occasion?: string[] | undefined;
  ageGroup?: CreateValues['ageGroup'] | undefined;
  listingPolicy?: CreateValues['listingPolicy'] | undefined;
  hsn?: string | undefined;
  templateId?: string | undefined;
};

function ReviewSummary({
  values,
  brandLabel,
  categoryLabel,
  templateLabel,
  onEdit,
}: {
  values: WizardSnapshot;
  brandLabel: string;
  categoryLabel: string;
  templateLabel: string;
  onEdit: (n: number) => void;
}) {
  const rows: Array<{ label: string; value: React.ReactNode; step: number }> = [
    { label: 'Name', value: values.name || '—', step: 0 },
    { label: 'Brand', value: brandLabel, step: 0 },
    { label: 'Category', value: categoryLabel, step: 0 },
    { label: 'Cut for', value: <span className="capitalize">{values.gender ?? '—'}</span>, step: 0 },
    { label: 'Description', value: values.description?.trim() || <span className="text-ink-3 italic">none</span>, step: 1 },
    { label: 'Badge', value: <span className="capitalize">{values.badge ?? 'none'}</span>, step: 1 },
    {
      label: 'Age group',
      value: values.ageGroup ? AGE_GROUP_LABEL[values.ageGroup] : <span className="text-ink-3 italic">unspecified</span>,
      step: 1,
    },
    {
      label: 'Occasion',
      value: (values.occasion?.length ?? 0) > 0
        ? <span className="capitalize">{values.occasion!.join(', ')}</span>
        : <span className="text-ink-3 italic">none</span>,
      step: 1,
    },
    { label: 'Template', value: templateLabel, step: 2 },
    { label: 'Return policy', value: POLICY_LABEL[(values.listingPolicy ?? 'return') as CreateValues['listingPolicy']], step: 3 },
    { label: 'HSN', value: values.hsn?.trim() || <span className="text-ink-3 italic">none</span>, step: 3 },
  ];

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-ink-2 leading-relaxed">
        Check everything looks right. <em>Create draft</em> will save this product as a draft. You'll add variants
        and gallery images on the next screen before publishing.
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xs border border-rule bg-paper-2/40 p-4 sm:grid-cols-2">
        {rows.map(({ label, value, step }) => (
          <div key={label} className="flex items-start justify-between gap-3 border-b border-rule/60 pb-2 last:border-b-0">
            <div className="min-w-0">
              <dt className="kicker text-ink-3">{label}</dt>
              <dd className="mt-0.5 break-words text-[13px] text-ink">{value}</dd>
            </div>
            <button
              type="button"
              onClick={() => onEdit(step)}
              className="shrink-0 text-[11px] underline text-ink-3 hover:text-ink"
            >
              Edit
            </button>
          </div>
        ))}
      </dl>
    </div>
  );
}
