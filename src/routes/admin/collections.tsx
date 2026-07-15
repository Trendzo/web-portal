import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, Archive, ImageOff, Layers, Plus, Search, Star, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { collectionStatusMeta, collectionKindLabel } from '@/lib/status';
import type {
  Collection,
  CollectionIndexRow,
  CollectionKind,
  CollectionStatus,
  Gender,
} from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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

const KIND_OPTIONS: ReadonlyArray<{ value: CollectionKind | 'all'; label: string }> = [
  { value: 'all', label: 'All kinds' },
  { value: 'outfit', label: 'Outfits' },
  { value: 'occasion', label: 'Occasions' },
  { value: 'drop', label: 'Drops' },
  { value: 'edit', label: 'Edits' },
  { value: 'trend', label: 'Trends' },
];

const STATUS_OPTIONS: ReadonlyArray<{ value: CollectionStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const GENDER_OPTIONS: ReadonlyArray<{ value: Gender | 'all'; label: string }> = [
  { value: 'all', label: 'All audiences' },
  { value: 'her', label: 'HER' },
  { value: 'him', label: 'HIM' },
  { value: 'unisex', label: 'Unisex' },
];

export default function AdminCollections() {
  const [kind, setKind] = useState<CollectionKind | 'all'>('all');
  const [status, setStatus] = useState<CollectionStatus | 'all'>('all');
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'collections', { kind, status, gender }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (kind !== 'all') params.set('kind', kind);
      if (status !== 'all') params.set('status', status);
      if (gender !== 'all') params.set('gender', gender);
      const qs = params.toString();
      return api<CollectionIndexRow[]>(`/admin/collections${qs ? `?${qs}` : ''}`);
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      api<Collection>(`/admin/collections/${id}`, {
        method: 'PATCH',
        body: { status: 'archived' },
      }),
    onSuccess: (c) => {
      toast.success(`Archived · ${c.name}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'collections'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Archive failed'),
  });

  const filtered = (data ?? []).filter((c) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      c.name.toLowerCase().includes(needle) ||
      c.slug.toLowerCase().includes(needle) ||
      c.id.toLowerCase().includes(needle)
    );
  });
  const activeCount = filtered.filter((c) => c.status === 'active').length;

  return (
    <Page>
      <PageHeader
        title={<>Featured Selections</>}
        description={
          <>
            Curate outfits, occasions, drops, edits, and trend rails. Collections appear
            on the consumer app once <em>active</em>; drafts and archived are hidden.
          </>
        }
        actions={
          <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>
            New collection
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            placeholder="Search by name, slug, or ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!pl-7"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={kind} onValueChange={(v) => setKind(v as CollectionKind | 'all')}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={gender} onValueChange={(v) => setGender(v as Gender | 'all')}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as CollectionStatus | 'all')}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-line">
              <Skeleton className="aspect-[4/5] w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load collections."
          action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <Empty
          icon={<Layers className="size-5" />}
          kicker="No collections"
          title={q ? 'Nothing matches that search.' : 'No collections yet.'}
          description={q ? 'Try a different keyword.' : 'Curate the first one to start populating the consumer rails.'}
          action={
            q ? (
              <Button variant="outline" iconLeft={<X className="size-3.5" />} onClick={() => setQ('')}>
                Clear search
              </Button>
            ) : (
              <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>
                New collection
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Results summary — quick tally so the operator knows the grid's scope. */}
          <div className="mb-3 flex items-center gap-2 text-[12.5px] text-ink-3">
            <span className="font-medium text-ink-2">
              {filtered.length} {filtered.length === 1 ? 'collection' : 'collections'}
            </span>
            {activeCount > 0 && (
              <>
                <span className="text-ink-4">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-success" />
                  {activeCount} live
                </span>
              </>
            )}
          </div>

          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
            data-stagger
          >
            {filtered.map((c, i) => (
              <CollectionCard
                key={c.id}
                ord={i + 1}
                c={c}
                onArchive={() => archive.mutate(c.id)}
                archiving={archive.isPending && archive.variables === c.id}
              />
            ))}
          </div>
        </>
      )}

      <CreateCollectionDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ['admin', 'collections'] });
        }}
      />
    </Page>
  );
}

function CollectionCard({
  ord,
  c,
  onArchive,
  archiving,
}: {
  ord: number;
  c: CollectionIndexRow;
  onArchive: () => void;
  archiving: boolean;
}) {
  const sMeta = collectionStatusMeta(c.status);
  // Accent palette drives the no-image placeholder gradient and a thin strip under
  // the media, so every card carries its collection's colour identity.
  const accents = (c.accentColors ?? []).filter(Boolean);
  const gradient =
    accents.length >= 2
      ? `linear-gradient(135deg, ${accents[0]}, ${accents[1]})`
      : accents.length === 1
        ? `linear-gradient(135deg, ${accents[0]}, ${accents[0]}22)`
        : undefined;
  const archived = c.status === 'archived';

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-line bg-bg shadow-xs transition-all',
        'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
        archived && 'opacity-75 hover:opacity-100',
      )}
    >
      {/* Media — the whole visual + title is one deep-link into the detail page. */}
      <Link to={`/admin/collections/${c.id}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-bg-2">
          {c.heroImageUrl ? (
            <img
              src={c.heroImageUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
            />
          ) : (
            <div
              className="flex size-full items-center justify-center"
              style={gradient ? { backgroundImage: gradient } : undefined}
            >
              {gradient ? (
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/85 drop-shadow">
                  {collectionKindLabel(c.kind)}
                </span>
              ) : (
                <ImageOff className="size-6 text-ink-4" />
              )}
            </div>
          )}

          {/* Legibility scrim behind the overlaid title. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

          {/* Top rail — ordinal (left) · featured + status (right). */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
            <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-mono text-[10.5px] tracking-wider text-white/90 backdrop-blur-sm">
              № {String(ord).padStart(2, '0')}
            </span>
            <div className="flex items-center gap-1.5">
              {c.isFeatured && (
                <span className="inline-flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 text-[10.5px] font-medium text-warning backdrop-blur-sm">
                  <Star className="size-3 fill-current" /> Featured
                </span>
              )}
              <Badge tone={sMeta.tone} className="shadow-sm">{sMeta.label}</Badge>
            </div>
          </div>

          {/* Overlaid identity — kind · audience kicker + name, magazine-cover style. */}
          <div className="absolute inset-x-0 bottom-0 p-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-white/80">
              <span>{collectionKindLabel(c.kind)}</span>
              <span className="text-white/50">·</span>
              <span>{c.gender}</span>
            </div>
            <h3 className="text-[18px] font-semibold italic leading-tight tracking-tight text-white line-clamp-2">
              {c.name}
            </h3>
          </div>
        </div>
      </Link>

      {/* Accent strip — the collection's palette as a hairline band. */}
      {gradient && <div className="h-[3px] w-full" style={{ backgroundImage: gradient }} />}

      {/* Footer — slug, listing count, and actions kept outside the media link so
          the buttons aren't nested inside the anchor. */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[11.5px] text-ink-3">/{c.slug}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-2">
            <Layers className="size-3 text-ink-4" />
            <span className="font-mono tabular-nums text-ink">{c.listingCount}</span>
            <span className="text-ink-3">{c.listingCount === 1 ? 'listing' : 'listings'}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {!archived && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onArchive}
              loading={archiving}
              title="Archive collection"
              aria-label="Archive collection"
            >
              {!archiving && <Archive className="size-4" />}
            </Button>
          )}
          <Button asChild variant="ghost" size="icon-sm" title="Open collection" aria-label="Open collection">
            <Link to={`/admin/collections/${c.id}`}>
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

// ── Create dialog ──────────────────────────────────────────────────

function CreateCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<CollectionKind>('outfit');
  const [gender, setGender] = useState<Gender>('unisex');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api<Collection>('/admin/collections', {
        method: 'POST',
        body: {
          name: name.trim(),
          slug: slug.trim(),
          kind,
          gender,
          ...(description.trim() ? { description: description.trim() } : {}),
        },
      }),
    onSuccess: () => {
      toast.success('Collection created — open it to add listings.');
      onOpenChange(false);
      setName('');
      setSlug('');
      setSlugTouched(false);
      setKind('outfit');
      setGender('unisex');
      setDescription('');
      setError(null);
      onCreated();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Create failed';
      setError(msg);
      toast.error(msg);
    },
  });

  function handleNameChange(next: string) {
    setName(next);
    if (!slugTouched) setSlug(slugify(next));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            Pick a name, kind, and audience. Hero image, accent colours, and listings come next on the detail page.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!name.trim()) return setError('Name is required.');
            if (!slug.trim()) return setError('Slug is required.');
            if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
              return setError('Slug must be lowercase letters, digits, and hyphens.');
            }
            create.mutate();
          }}
          className="space-y-5"
          noValidate
        >
          <div>
            <Label htmlFor="cName" required>Name</Label>
            <Input id="cName" value={name} onChange={(e) => handleNameChange(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cSlug" required hint="lowercase, hyphenated">Slug</Label>
            <Input
              id="cSlug"
              mono
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setSlugTouched(true);
              }}
            />
            <p className="mt-1 text-[11.5px] text-ink-3">
              Used in deep links: <span className="font-mono text-ink">/collections/{slug || 'your-slug'}</span>
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="cKind" required>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CollectionKind)}>
                <SelectTrigger id="cKind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cGender" required>Audience</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                <SelectTrigger id="cGender"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="cDesc" hint="optional">Description</Label>
            <Textarea
              id="cDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <FieldError>{error}</FieldError>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={create.isPending}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
