import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Edit3, ExternalLink, ImageOff, Plus, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Brand, BrandRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ColorPicker } from '@/components/ui/color-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';

export default function AdminBrands() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<BrandRow | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: () => api<BrandRow[]>('/admin/brands'),
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      api<{ id: string; deleted: boolean; listingsUnbranded: number }>(`/admin/brands/${id}`, { method: 'DELETE' }),
    onSuccess: (r) => {
      const orph = r.listingsUnbranded;
      toast.success(orph > 0 ? `Brand deleted · ${orph} listing${orph === 1 ? '' : 's'} now unbranded` : 'Brand deleted');
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
      // Listings page renders brand names — refresh so the "Unbranded" tag appears.
      void qc.invalidateQueries({ queryKey: ['retailer'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const filtered = (data ?? []).filter((b) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return b.name.toLowerCase().includes(needle) || b.slug.toLowerCase().includes(needle);
  });

  return (
    <Page>
      <PageHeader
        title={<>Brands</>}
        description={
          <>
            Names are case-insensitive — <em>Puma</em>, <em>PUMA</em>, and <em>puma</em> all collide.
            Deleting a brand keeps existing products visible; they render as <em>Unbranded</em>{' '}
            until a new brand is assigned.
          </>
        }
        actions={
          <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>
            New brand
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            placeholder="Search by name or slug…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!pl-7"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-px border-y border-rule">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load brands."
          action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <Empty
          kicker="No brands"
          title={q ? 'Nothing matches that search.' : 'No brands yet.'}
          action={!q ? (
            <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>
              New brand
            </Button>
          ) : undefined}
        />
      ) : (
        <ul className="border-y border-rule divide-y divide-rule">
          {filtered.map((b) => (
            <BrandRowItem
              key={b.id}
              brand={b}
              onEdit={() => setEditing(b)}
              onDelete={() => setDeleting(b)}
            />
          ))}
        </ul>
      )}

      <CreateOrEditDialog
        target={editing}
        open={Boolean(creating || editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'brands'] })}
      />

      <DeleteConfirm
        target={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id)}
        loading={del.isPending}
      />
    </Page>
  );
}

function BrandRowItem({
  brand,
  onEdit,
  onDelete,
}: {
  brand: BrandRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="grid grid-cols-12 items-center gap-4 px-3 py-3.5 hover:bg-surface/40">
      <div className="col-span-1">
        {brand.logoUrl ? (
          <div className="aspect-square w-full overflow-hidden rounded-xs border border-rule bg-paper-2">
            <img src={brand.logoUrl} alt="" className="size-full object-contain" loading="lazy" />
          </div>
        ) : (
          <div
            className="grid aspect-square w-full place-items-center rounded-xs border border-ink/10"
            style={{ background: brand.tintColor ?? 'transparent' }}
          >
            {brand.tintColor ? null : <ImageOff className="size-4 text-ink-4" />}
          </div>
        )}
      </div>
      <div className="col-span-6 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink">{brand.name}</span>
          {!brand.isActive && <Badge tone="neutral">Hidden</Badge>}
        </div>
        <div className="flex items-center gap-2 font-mono text-[11.5px] text-ink-3">
          /{brand.slug}
          {brand.domain && (
            <a
              href={brand.domain}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"
            >
              {hostname(brand.domain)} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
      <div className="col-span-3 text-right font-mono text-[12.5px] text-ink-3">
        <span className="kicker mr-2">Listings</span>
        {brand.listingCount}
      </div>
      <div className="col-span-2 flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" iconLeft={<Edit3 className="size-3.5" />} onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Trash2 className="size-3.5 text-danger" />}
          onClick={onDelete}
        />
      </div>
    </li>
  );
}

// ── Create / Edit dialog ───────────────────────────────────────────

function CreateOrEditDialog({
  target,
  open,
  onClose,
  onSaved,
}: {
  target: BrandRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(target);
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [name, setName] = useState('');
  const [tintColor, setTintColor] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [domain, setDomain] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSlugTouched(Boolean(target));
    if (target) {
      setSlug(target.slug);
      setName(target.name);
      setTintColor(target.tintColor ?? '');
      setLogoUrl(target.logoUrl ?? '');
      setDomain(target.domain ?? '');
      setIsActive(target.isActive);
    } else {
      setSlug('');
      setName('');
      setTintColor('');
      setLogoUrl('');
      setDomain('');
      setIsActive(true);
    }
  }, [open, target]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        slug: slug.trim(),
        name: name.trim(),
        ...(tintColor ? { tintColor } : isEdit ? { tintColor: null } : {}),
        ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : isEdit ? { logoUrl: null } : {}),
        ...(domain.trim() ? { domain: domain.trim() } : isEdit ? { domain: null } : {}),
        isActive,
      };
      return target
        ? api<Brand>(`/admin/brands/${target.id}`, { method: 'PATCH', body })
        : api<Brand>('/admin/brands', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success(target ? 'Brand updated' : 'Brand created');
      onClose();
      onSaved();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Save failed';
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${target?.name}` : 'New brand'}</DialogTitle>
          <DialogDescription>
            Name uniqueness is case-insensitive. Tint colour and logo URL feed the consumer card.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!name.trim()) return setError('Name is required.');
            if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
              return setError('Slug must be lowercase letters, digits, and hyphens.');
            }
            save.mutate();
          }}
          className="space-y-5"
          noValidate
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="bName" required>Name</Label>
              <Input
                id="bName"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </div>
            <div>
              <Label htmlFor="bSlug" required hint="lowercase, hyphens">Slug</Label>
              <Input
                id="bSlug"
                mono
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase());
                  setSlugTouched(true);
                }}
              />
            </div>
          </div>

          <div>
            <Label hint="theme-tint on the consumer card">Tint colour</Label>
            <ColorPicker value={tintColor} onChange={setTintColor} placeholder="No tint" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="bLogo" hint="hosted URL">Logo URL</Label>
              <Input id="bLogo" mono value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://cdn.example.com/logo.svg" />
            </div>
            <div>
              <Label htmlFor="bDomain" hint="brand website">Domain</Label>
              <Input id="bDomain" mono value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="https://brand.com" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="bActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 accent-ink"
            />
            <label htmlFor="bActive" className="text-[13.5px] text-ink-2">
              Active — show in retailer brand picker
            </label>
          </div>

          <FieldError>{error}</FieldError>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={save.isPending}>
              {isEdit ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────

function DeleteConfirm({
  target,
  onClose,
  onConfirm,
  loading,
}: {
  target: BrandRow | null;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {target?.name}?</DialogTitle>
          <DialogDescription>
            {target && target.listingCount > 0 ? (
              <>
                <strong className="text-ink">{target.listingCount}</strong> listing
                {target.listingCount === 1 ? '' : 's'} currently use this brand. They will stay
                live but render as <em>Unbranded</em> until a retailer reassigns a brand.
              </>
            ) : (
              <>This brand is not used by any listings yet — clean delete.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            type="button"
            variant="ink"
            caps
            className={cn('!bg-danger !text-paper hover:!bg-danger/90')}
            onClick={onConfirm}
            loading={loading}
          >
            Delete brand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
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
