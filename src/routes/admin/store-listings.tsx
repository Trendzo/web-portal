import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ImageOff, Plus, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { listingStatusMeta } from '@/lib/status';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
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
import { BulkActionBar } from '@/components/admin/bulk-action-bar';
import { useBulkSelect } from '@/hooks/useBulkSelect';

interface VariantSummary {
  id: string;
  sku: string | null;
  attributesLabel: string;
  stock: number;
  pricePaise: number;
  isActive: boolean;
}

interface ListingRow {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'retired';
  gender: string;
  galleryUrls: string[];
  brand: { name: string } | null;
  category: { label: string } | null;
  variants: VariantSummary[];
}

interface BrandRow { id: string; name: string; }
interface CategoryRow { id: string; label: string; }

export default function AdminStoreListings() {
  const { id: retailerId, storeId } = useParams<{ id: string; storeId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState<'all' | 'draft' | 'active' | 'retired'>('all');
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store-listings', storeId, status],
    queryFn: () =>
      api<ListingRow[]>(`/admin/stores/${storeId}/listings${status === 'all' ? '' : `?status=${status}`}`),
    enabled: Boolean(storeId),
  });
  const rows = data ?? [];

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const n = q.toLowerCase();
    return rows.filter(
      (l) => l.name.toLowerCase().includes(n) || (l.brand?.name.toLowerCase().includes(n) ?? false),
    );
  }, [rows, q]);

  const bulk = useBulkSelect(filtered);

  const setListingStatus = useMutation({
    mutationFn: ({ listingId, nextStatus }: { listingId: string; nextStatus: 'draft' | 'active' | 'retired' }) =>
      api(`/admin/stores/${storeId}/listings/${listingId}`, { method: 'PATCH', body: { status: nextStatus } }),
    onSuccess: () => {
      toast.success('Listing updated');
      void qc.invalidateQueries({ queryKey: ['admin', 'store-listings', storeId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const bulkStatus = useMutation({
    mutationFn: (next: 'active' | 'draft' | 'retired') =>
      api<{ updated: number; skipped: number }>(`/admin/stores/${storeId}/listings/bulk-status`, {
        method: 'POST',
        body: { ids: bulk.selectedIds, status: next },
      }),
    onSuccess: (r) => {
      toast.success(`${r.updated} updated${r.skipped > 0 ? ` · ${r.skipped} skipped` : ''}`);
      bulk.clear();
      void qc.invalidateQueries({ queryKey: ['admin', 'store-listings', storeId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Bulk update failed'),
  });

  const bulkDelete = useMutation({
    mutationFn: () =>
      api<{ deleted: number; skipped: number }>(`/admin/stores/${storeId}/listings/bulk-delete`, {
        method: 'POST',
        body: { ids: bulk.selectedIds },
      }),
    onSuccess: (r) => {
      toast.success(`${r.deleted} deleted${r.skipped > 0 ? ` · ${r.skipped} skipped (non-drafts)` : ''}`);
      bulk.clear();
      void qc.invalidateQueries({ queryKey: ['admin', 'store-listings', storeId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Bulk delete failed'),
  });

  return (
    <Page>
      <PageHeader
        kicker="Store"
        title="Listings"
        description="Browse, create, and manage product listings for this store."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to={`/admin/retailers/${retailerId}/stores/${storeId}`}>Back</Link>
            </Button>
            <Button variant="ink" size="sm" iconLeft={<Plus className="size-3.5" />} onClick={() => setAddOpen(true)}>
              New listing
            </Button>
          </div>
        }
      />

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
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[12px] text-ink-3 whitespace-nowrap">{filtered.length} listing{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="overflow-hidden rounded border border-rule">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[52px] rounded-none" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded border border-rule bg-bg-2 p-8 text-center text-[13px] text-ink-3 italic">
          {q ? 'No listings match that search.' : 'No listings yet.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-rule">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-rule bg-bg-2/60">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={bulk.isAllSelected}
                    onChange={bulk.toggleAll}
                    className="size-4 cursor-pointer accent-accent"
                  />
                </th>
                <th className="w-14 py-2.5 pl-4 pr-2" />
                <th className="py-2.5 pr-4 text-left kicker text-ink-3">Product</th>
                <th className="py-2.5 pr-4 text-left kicker text-ink-3 w-28">Status</th>
                <th className="py-2.5 pr-4 text-right kicker text-ink-3 w-20">Variants</th>
                <th className="py-2.5 pr-4 text-right kicker text-ink-3 w-24">Stock</th>
                <th className="w-36 py-2.5 pr-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {filtered.map((l) => {
                const meta = listingStatusMeta(l.status);
                const variantCount = l.variants.length;
                const totalStock = l.variants.reduce((acc, v) => acc + v.stock, 0);
                const hero = l.galleryUrls?.[0] ?? null;
                const pending = setListingStatus.isPending && setListingStatus.variables?.listingId === l.id;
                return (
                  <tr
                    key={l.id}
                    onClick={() => navigate(`/admin/retailers/${retailerId}/stores/${storeId}/listings/${l.id}`)}
                    className={`cursor-pointer transition-colors ${bulk.isSelected(l.id) ? 'bg-accent/5' : 'hover:bg-bg-2/40'}`}
                  >
                    <td className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={bulk.isSelected(l.id)}
                        onChange={() => bulk.toggle(l.id)}
                        className="size-4 cursor-pointer accent-accent"
                      />
                    </td>
                    <td className="w-14 py-2 pl-4 pr-2">
                      <div className="size-9 shrink-0 overflow-hidden rounded-xs border border-rule bg-bg-2">
                        {hero ? (
                          <img src={hero} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <div className="grid size-full place-items-center text-ink-4">
                            <ImageOff className="size-3.5" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-col">
                        <span className="truncate max-w-xs text-[13.5px] font-medium text-ink">{l.name}</span>
                        <span className="mt-0.5 truncate text-[11px] text-ink-3">
                          <span className="font-medium text-ink-2">{l.brand?.name ?? 'Unbranded'}</span>
                          {' · '}{l.category?.label ?? 'Uncategorised'}
                          {' · '}<span className="capitalize">{l.gender}</span>
                        </span>
                      </div>
                    </td>
                    <td className="w-28 py-2 pr-4">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="w-20 py-2 pr-4 text-right">
                      <span className={`font-mono tabular-nums text-[12.5px] ${variantCount > 0 ? 'text-ink' : 'text-ink-4'}`}>
                        {String(variantCount).padStart(2, '0')}
                      </span>
                    </td>
                    <td className="w-24 py-2 pr-4 text-right">
                      <span className="font-mono tabular-nums text-[12.5px] text-ink">
                        {String(totalStock).padStart(3, '0')}
                      </span>
                    </td>
                    <td className="w-36 py-2 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {(l.status === 'active' || l.status === 'draft') && (
                        <Button
                          size="sm"
                          variant={l.status === 'active' ? 'outline' : 'accent'}
                          loading={pending}
                          onClick={() =>
                            setListingStatus.mutate({
                              listingId: l.id,
                              nextStatus: l.status === 'active' ? 'draft' : 'active',
                            })
                          }
                        >
                          {l.status === 'active' ? 'Unpublish' : 'Publish'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClear={bulk.clear}
        actions={[
          { label: 'Publish', onClick: () => bulkStatus.mutate('active'), loading: bulkStatus.isPending },
          { label: 'Unpublish', onClick: () => bulkStatus.mutate('draft'), loading: bulkStatus.isPending },
          { label: 'Retire', onClick: () => bulkStatus.mutate('retired'), loading: bulkStatus.isPending },
          { label: 'Delete drafts', danger: true, onClick: () => bulkDelete.mutate(), loading: bulkDelete.isPending },
        ]}
      />

      <NewListingDialog
        open={addOpen}
        storeId={storeId ?? ''}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setAddOpen(false);
          void qc.invalidateQueries({ queryKey: ['admin', 'store-listings', storeId] });
        }}
      />
    </Page>
  );
}

function NewListingDialog({
  open,
  storeId,
  onClose,
  onCreated,
}: {
  open: boolean;
  storeId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [gender, setGender] = useState<'her' | 'him' | 'unisex'>('unisex');
  const [description, setDescription] = useState('');

  const { data: brands } = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: () => api<BrandRow[]>('/admin/brands'),
    enabled: open,
  });
  const { data: categories } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api<CategoryRow[]>('/admin/categories'),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      api(`/admin/stores/${storeId}/listings`, {
        method: 'POST',
        body: {
          name: name.trim(),
          brandId,
          categoryId,
          gender,
          description: description.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Listing created');
      setName(''); setBrandId(''); setCategoryId(''); setGender('unisex'); setDescription('');
      onCreated();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Create failed'),
  });

  const canSubmit = name.trim().length > 0 && brandId && categoryId;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setName(''); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New listing</DialogTitle>
          <DialogDescription>
            Creates the listing as `draft`. Add variants + gallery from the listing detail page before publishing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="adm-name" required>Product name</Label>
            <Input id="adm-name" value={name} onChange={(e) => setName(e.target.value)} />
            <FieldError>{name && name.trim().length === 0 ? 'Required' : ''}</FieldError>
          </div>
          <div>
            <Label htmlFor="adm-brand" required>Brand</Label>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger id="adm-brand"><SelectValue placeholder="Select brand" /></SelectTrigger>
              <SelectContent>
                {(brands ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="adm-cat" required>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="adm-cat"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="adm-gender" required>Gender</Label>
            <Select value={gender} onValueChange={(v) => setGender(v as 'her' | 'him' | 'unisex')}>
              <SelectTrigger id="adm-gender"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="her">her</SelectItem>
                <SelectItem value="him">him</SelectItem>
                <SelectItem value="unisex">unisex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="adm-desc">Description (optional)</Label>
            <Input id="adm-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="ink" disabled={!canSubmit} loading={create.isPending} onClick={() => create.mutate()}>
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
