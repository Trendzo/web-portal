import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, Archive, ImageOff, Plus, Search, Star } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
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
        <div className="space-y-px border-y border-rule">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load collections."
          action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <Empty
          kicker="No collections"
          title={q ? 'Nothing matches that search.' : 'No collections yet.'}
          description={q ? 'Try a different keyword.' : 'Curate the first one to start populating the consumer rails.'}
          action={
            !q ? (
              <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>
                New collection
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="border-y border-rule divide-y divide-rule" data-stagger>
          {filtered.map((c, i) => (
            <CollectionRow
              key={c.id}
              ord={i + 1}
              c={c}
              onArchive={() => archive.mutate(c.id)}
              archiving={archive.isPending && archive.variables === c.id}
            />
          ))}
        </ul>
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

function CollectionRow({
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
  return (
    <li className="grid grid-cols-12 items-center gap-4 px-4 py-5">
      <div className="col-span-1">
        <span className="font-mono text-[11px] tracking-wider text-ink-3">№ {String(ord).padStart(2, '0')}</span>
      </div>
      <div className="col-span-2">
        {c.heroImageUrl ? (
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xs border border-rule bg-paper-2">
            <img src={c.heroImageUrl} alt="" className="size-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div className="grid aspect-[3/4] w-full place-items-center rounded-xs border border-rule bg-paper-2 text-ink-4">
            <ImageOff className="size-5" />
          </div>
        )}
      </div>
      <div className="col-span-5">
        <div className="kicker text-ink-3 mb-1 flex items-center gap-2">
          {collectionKindLabel(c.kind)}
          <span className="text-ink-4">·</span>
          <span className="uppercase">{c.gender}</span>
          {c.isFeatured && (
            <>
              <span className="text-ink-4">·</span>
              <span className="inline-flex items-center gap-1 text-warning">
                <Star className="size-3 fill-current" /> Featured
              </span>
            </>
          )}
        </div>
        <Link
          to={`/admin/collections/${c.id}`}
          className="font-display italic text-[22px] leading-tight text-ink hover:underline underline-offset-4"
        >
          {c.name}
        </Link>
        <p className="mt-1 font-mono text-[12px] text-ink-3">/{c.slug}</p>
      </div>
      <div className="col-span-2">
        <div className="kicker text-ink-3">Listings</div>
        <div className="font-mono text-[18px] tabular-nums text-ink">{c.listingCount}</div>
      </div>
      <div className="col-span-2 flex flex-col items-end gap-2">
        <Badge tone={sMeta.tone}>{sMeta.label}</Badge>
        <div className="flex items-center gap-1.5">
          {c.status !== 'archived' && (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Archive className="size-3.5" />}
              onClick={onArchive}
              loading={archiving}
            >
              Archive
            </Button>
          )}
          <Button asChild variant="outline" size="sm" caps iconRight={<ArrowUpRight className="size-3.5" />}>
            <Link to={`/admin/collections/${c.id}`}>Open</Link>
          </Button>
        </div>
      </div>
    </li>
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
