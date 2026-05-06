import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  Check,
  GripVertical,
  ImageOff,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { collectionStatusMeta, collectionKindLabel, formatPaise } from '@/lib/status';
import type {
  Collection,
  CollectionDetail,
  CollectionKind,
  CollectionStatus,
  Gender,
  Listing,
} from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { MediaGallery } from '@/components/ui/media-gallery';
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker';
import { ColorPicker } from '@/components/ui/color-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const KIND_OPTIONS: ReadonlyArray<{ value: CollectionKind; label: string }> = [
  { value: 'outfit', label: 'Outfit' },
  { value: 'occasion', label: 'Occasion' },
  { value: 'drop', label: 'Drop' },
  { value: 'edit', label: 'Edit' },
  { value: 'trend', label: 'Trend' },
];

const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: 'her', label: 'HER' },
  { value: 'him', label: 'HIM' },
  { value: 'unisex', label: 'Unisex' },
];

const STATUS_OPTIONS: ReadonlyArray<{ value: CollectionStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export default function AdminCollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'collection', id],
    queryFn: () => api<CollectionDetail>(`/admin/collections/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading || !data) {
    return (
      <Page>
        <Skeleton className="mb-4 h-12 w-2/3" />
        <Skeleton className="h-64 w-full" />
        {isError && (
          <Empty
            kicker="Connection lost"
            title="Couldn't load this collection."
            action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
          />
        )}
      </Page>
    );
  }

  const c = data;
  const sMeta = collectionStatusMeta(c.status);

  return (
    <Page>
      <div className="mb-3">
        <Link
          to="/admin/collections"
          className="inline-flex items-center gap-1 text-[12px] uppercase tracking-[0.16em] text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> All collections
        </Link>
      </div>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <em>{c.name}</em>
            <Badge tone={sMeta.tone}>{sMeta.label}</Badge>
          </span>
        }
        description={
          <>
            <span className="kicker">{collectionKindLabel(c.kind)}</span>
            <span className="mx-2 text-ink-4">·</span>
            <span className="kicker uppercase">{c.gender}</span>
            <span className="mx-2 text-ink-4">·</span>
            <span className="font-mono text-[12.5px]">/{c.slug}</span>
          </>
        }
      />

      <DetailsCard collection={c} onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'collection', id] })} />

      <div className="mt-12">
        <ListingsRoster
          collection={c}
          onChanged={() => {
            void qc.invalidateQueries({ queryKey: ['admin', 'collection', id] });
            void qc.invalidateQueries({ queryKey: ['admin', 'collections'] });
          }}
        />
      </div>
    </Page>
  );
}

// ── Metadata card ─────────────────────────────────────────────────

function DetailsCard({
  collection,
  onSaved,
}: {
  collection: CollectionDetail;
  onSaved: () => void;
}) {
  const [name, setName] = useState(collection.name);
  const [slug, setSlug] = useState(collection.slug);
  const [description, setDescription] = useState(collection.description ?? '');
  const [kind, setKind] = useState<CollectionKind>(collection.kind);
  const [gender, setGender] = useState<Gender>(collection.gender);
  const [status, setStatus] = useState<CollectionStatus>(collection.status);
  const [isFeatured, setIsFeatured] = useState(collection.isFeatured);
  const [sortOrder, setSortOrder] = useState(String(collection.sortOrder));
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(collection.heroImageUrl);
  const [accentColors, setAccentColors] = useState<string[]>(collection.accentColors ?? []);
  const [accentInput, setAccentInput] = useState('');
  const [range, setRange] = useState<DateRangeValue>({
    from: collection.startsAt ? new Date(collection.startsAt) : null,
    to: collection.endsAt ? new Date(collection.endsAt) : null,
  });
  const [error, setError] = useState<string | null>(null);

  // Re-hydrate when the underlying record updates (e.g. after a PATCH refetch)
  useEffect(() => {
    setName(collection.name);
    setSlug(collection.slug);
    setDescription(collection.description ?? '');
    setKind(collection.kind);
    setGender(collection.gender);
    setStatus(collection.status);
    setIsFeatured(collection.isFeatured);
    setSortOrder(String(collection.sortOrder));
    setHeroImageUrl(collection.heroImageUrl);
    setAccentColors(collection.accentColors ?? []);
    setRange({
      from: collection.startsAt ? new Date(collection.startsAt) : null,
      to: collection.endsAt ? new Date(collection.endsAt) : null,
    });
  }, [collection]);

  const save = useMutation({
    mutationFn: () =>
      api<Collection>(`/admin/collections/${collection.id}`, {
        method: 'PATCH',
        body: {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() ? description.trim() : null,
          kind,
          gender,
          status,
          isFeatured,
          sortOrder: parseInt(sortOrder, 10) || 0,
          heroImageUrl: heroImageUrl ?? null,
          accentColors,
          startsAt: range.from ? range.from.toISOString() : null,
          endsAt: range.to ? range.to.toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success('Collection updated');
      onSaved();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Save failed';
      setError(msg);
      toast.error(msg);
    },
  });


  return (
    <section>
      <SectionHeading title="Details" hint="Audience, kind, and presentation" />

      <form
        className="grid gap-6 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!name.trim()) return setError('Name is required.');
          if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
            return setError('Slug must be lowercase letters, digits, and hyphens.');
          }
          save.mutate();
        }}
        noValidate
      >
        <div>
          <Label htmlFor="dName" required>Name</Label>
          <Input id="dName" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="dSlug" required hint="lowercase, hyphenated">Slug</Label>
          <Input id="dSlug" mono value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="dDesc" hint="optional">Description</Label>
          <Textarea id="dDesc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="dKind" required>Kind</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as CollectionKind)}>
            <SelectTrigger id="dKind"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="dGender" required>Audience</Label>
          <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
            <SelectTrigger id="dGender"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="dStatus" required>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as CollectionStatus)}>
            <SelectTrigger id="dStatus"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="dSort" hint="lower = earlier">Sort order</Label>
          <Input id="dSort" mono type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <Label hint="optional — leave empty for evergreen collections">Active window</Label>
          <DateRangePicker value={range} onChange={setRange} />
          <p className="mt-1 text-[11.5px] text-ink-3">
            Drops use the start time as the launch moment. Evergreen kinds (outfits, occasions) usually leave both empty.
          </p>
        </div>

        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            id="dFeatured"
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="size-4 accent-ink"
          />
          <label htmlFor="dFeatured" className="text-[13.5px] text-ink-2">
            Featured — surface on the consumer home rail above other collections of this kind
          </label>
        </div>

        <div className="sm:col-span-2">
          <Label hint={`${accentColors.length}/6 — used as glow / chip tint on the collection card`}>
            Accent colours
          </Label>

          {accentColors.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {accentColors.map((c) => (
                <li
                  key={c}
                  className="inline-flex items-center gap-2 rounded-xs border border-rule px-2 py-1 text-[12px] font-mono"
                  style={{ background: c, color: contrastInk(c) }}
                >
                  {c.toUpperCase()}
                  <button
                    type="button"
                    onClick={() => setAccentColors(accentColors.filter((x) => x !== c))}
                    className="grid size-4 place-items-center"
                    aria-label={`Remove ${c}`}
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="max-w-md">
            <ColorPicker
              value={accentInput}
              onChange={(picked) => {
                if (!picked) {
                  setAccentInput('');
                  return;
                }
                const lower = picked.toLowerCase();
                if (accentColors.includes(lower)) {
                  setAccentInput('');
                  return;
                }
                if (accentColors.length >= 6) {
                  setError('Up to six accent colours per collection.');
                  return;
                }
                setAccentColors([...accentColors, lower]);
                setAccentInput('');
                setError(null);
              }}
              placeholder={accentColors.length === 0 ? 'Pick the first accent colour' : 'Add another'}
              disabled={accentColors.length >= 6}
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <div className="kicker mb-2 text-ink-3">Hero image</div>
          <MediaGallery
            urls={heroImageUrl ? [heroImageUrl] : []}
            onChange={(next) => setHeroImageUrl(next[0] ?? null)}
            uploadFolder={`collections/${collection.id}`}
          />
          <p className="mt-1 text-[11.5px] text-ink-3">
            Only the first image is used. Replace by uploading a new one or pasting a URL.
          </p>
        </div>

        <div className="sm:col-span-2">
          <FieldError>{error}</FieldError>
          <div className="mt-2 flex justify-end">
            <Button type="submit" variant="ink" caps loading={save.isPending} iconLeft={<Save className="size-3.5" />}>
              Save details
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

// ── Listing roster ────────────────────────────────────────────────

function ListingsRoster({
  collection,
  onChanged,
}: {
  collection: CollectionDetail;
  onChanged: () => void;
}) {
  const [items, setItems] = useState(collection.listings);
  const [picking, setPicking] = useState(false);
  const dirty = useMemo(
    () => items.map((i) => i.id).join(',') !== collection.listings.map((i) => i.id).join(','),
    [items, collection.listings],
  );

  useEffect(() => {
    setItems(collection.listings);
  }, [collection.listings]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setItems(arrayMove(items, oldIndex, newIndex));
  }

  const save = useMutation({
    mutationFn: (listingIds: string[]) =>
      api<{ collectionId: string; listingCount: number }>(`/admin/collections/${collection.id}/listings`, {
        method: 'PUT',
        body: { listingIds },
      }),
    onSuccess: () => {
      toast.success('Listings saved');
      onChanged();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-3">
        <SectionHeading title="Listings" hint={`${items.length} on file`} />
        <div className="flex items-center gap-2">
          {dirty && (
            <Button
              variant="ink"
              caps
              size="sm"
              loading={save.isPending}
              iconLeft={<Save className="size-3.5" />}
              onClick={() => save.mutate(items.map((i) => i.id))}
            >
              Save order
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            iconLeft={<Plus className="size-3.5" />}
            onClick={() => setPicking(true)}
          >
            Add listings
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Empty
          kicker="Empty"
          title="No listings yet."
          description="Add listings to populate this collection on the consumer rails."
          action={
            <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setPicking(true)}>
              Add listings
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="border-y border-rule divide-y divide-rule">
              {items.map((it, i) => (
                <SortableListingRow
                  key={it.id}
                  ord={i + 1}
                  listing={it}
                  onRemove={() => setItems(items.filter((x) => x.id !== it.id))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <ListingPickerDialog
        open={picking}
        onOpenChange={setPicking}
        existingIds={new Set(items.map((i) => i.id))}
        onPick={(picked) => {
          // Append picks; preserve current order, dedup. Picked listings come from a
          // search endpoint that doesn't carry sortOrder — we synthesize one by
          // appending after the current tail; the server re-numbers on save anyway.
          const have = new Set(items.map((i) => i.id));
          const start = items.length;
          const merged = [
            ...items,
            ...picked
              .filter((p) => !have.has(p.id))
              .map((p, i) => ({ ...p, sortOrder: start + i })),
          ];
          setItems(merged);
          setPicking(false);
        }}
      />
    </section>
  );
}

function SortableListingRow({
  ord,
  listing,
  onRemove,
}: {
  ord: number;
  listing: Listing & { sortOrder: number };
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listing.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const hero = listing.galleryUrls?.[0] ?? null;
  return (
    <li ref={setNodeRef} style={style} className="grid grid-cols-12 items-center gap-4 px-3 py-3">
      <div className="col-span-1 flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="grid size-7 cursor-grab place-items-center text-ink-3 hover:text-ink active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <span className="font-mono text-[11px] text-ink-3">{String(ord).padStart(2, '0')}</span>
      </div>
      <div className="col-span-1">
        {hero ? (
          <div className="aspect-square w-full overflow-hidden rounded-xs border border-rule bg-paper-2">
            <img src={hero} alt="" className="size-full object-contain" loading="lazy" />
          </div>
        ) : (
          <div className="grid aspect-square w-full place-items-center rounded-xs border border-rule bg-paper-2 text-ink-4">
            <ImageOff className="size-4" />
          </div>
        )}
      </div>
      <div className="col-span-7">
        <div className="font-medium text-ink">{listing.name}</div>
        <div className="kicker mt-0.5 text-ink-3">
          <span className="uppercase">{listing.gender}</span>
          <span className="mx-1.5 text-ink-4">·</span>
          <span className="font-mono normal-case text-[11px]">{listing.id}</span>
        </div>
      </div>
      <div className="col-span-2 text-right font-mono text-[12.5px] text-ink-3">{listing.status}</div>
      <div className="col-span-1 text-right">
        <Button variant="ghost" size="sm" iconLeft={<Trash2 className="size-3.5" />} onClick={onRemove}>
          Remove
        </Button>
      </div>
    </li>
  );
}

// ── Listing picker (admin search across all stores) ───────────────

function ListingPickerDialog({
  open,
  onOpenChange,
  existingIds,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existingIds: Set<string>;
  onPick: (listings: Listing[]) => void;
}) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Listing[]>([]);

  useEffect(() => {
    if (!open) {
      setQ('');
      setPicked([]);
    }
  }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'listings', q],
    queryFn: () => {
      const params = new URLSearchParams({ status: 'active', limit: '25' });
      if (q.trim()) params.set('q', q.trim());
      return api<Listing[]>(`/admin/listings?${params.toString()}`);
    },
    enabled: open,
  });

  const pickedSet = new Set(picked.map((p) => p.id));

  function toggle(l: Listing) {
    if (pickedSet.has(l.id)) {
      setPicked(picked.filter((p) => p.id !== l.id));
    } else {
      setPicked([...picked, l]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add listings</DialogTitle>
          <DialogDescription>
            Search across all storefronts. Only <em>active</em> listings are shown.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            autoFocus
            placeholder="Search by name or description…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!pl-7"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto border-y border-rule">
          {isLoading ? (
            <div className="space-y-px">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="py-10 text-center text-[13px] text-ink-3">
              {q.trim() ? 'No listings match that search.' : 'Type to search across stores.'}
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {data!.map((l) => {
                const inCollection = existingIds.has(l.id);
                const selected = pickedSet.has(l.id);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      disabled={inCollection}
                      onClick={() => toggle(l)}
                      className={
                        'grid w-full grid-cols-12 items-center gap-3 px-2 py-3 text-left transition-colors ' +
                        (inCollection
                          ? 'cursor-not-allowed opacity-50'
                          : selected
                            ? 'bg-paper-2'
                            : 'hover:bg-surface/40')
                      }
                    >
                      <div className="col-span-1 grid size-5 place-items-center">
                        {inCollection ? (
                          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">In</span>
                        ) : selected ? (
                          <span className="grid size-5 place-items-center rounded-full bg-ink text-paper">
                            <Check className="size-3" />
                          </span>
                        ) : (
                          <span className="size-4 rounded-xs border border-rule" />
                        )}
                      </div>
                      <div className="col-span-2">
                        {l.galleryUrls?.[0] ? (
                          <div className="aspect-square w-full overflow-hidden rounded-xs border border-rule bg-paper-2">
                            <img src={l.galleryUrls[0]} alt="" className="size-full object-contain" loading="lazy" />
                          </div>
                        ) : (
                          <div className="grid aspect-square w-full place-items-center rounded-xs border border-rule bg-paper-2 text-ink-4">
                            <ImageOff className="size-4" />
                          </div>
                        )}
                      </div>
                      <div className="col-span-7">
                        <div className="font-medium text-ink">{l.name}</div>
                        <div className="kicker mt-0.5 text-ink-3">
                          <span className="uppercase">{l.gender}</span>
                          <span className="mx-1.5 text-ink-4">·</span>
                          <span className="font-mono normal-case text-[11px]">{l.id}</span>
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-mono text-[12.5px] tabular-nums text-ink-3">
                        {l.variants?.[0] ? formatPaise(l.variants[0].pricePaise) : '—'}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <span className="mr-auto text-[12px] uppercase tracking-[0.14em] text-ink-3">
            {picked.length} selected
          </span>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            variant="ink"
            caps
            disabled={picked.length === 0}
            onClick={() => onPick(picked)}
          >
            Add {picked.length || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function contrastInk(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1A1410' : '#F4EEE2';
}
