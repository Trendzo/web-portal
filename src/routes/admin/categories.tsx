import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Edit3, Folder, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Category, CategoryRow, Gender } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { cn } from '@/lib/cn';

type TreeNode = CategoryRow & { children: TreeNode[]; depth: number };

export default function AdminCategories() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState<{ parent: CategoryRow | null } | null>(null);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api<CategoryRow[]>('/admin/categories'),
  });

  const tree = useMemo(() => buildTree(data ?? []), [data]);
  const allParentIds = useMemo(() => new Set((data ?? []).filter((c) => hasChildren(c.id, data ?? [])).map((c) => c.id)), [data]);

  const del = useMutation({
    mutationFn: (id: string) => api(`/admin/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Category deleted');
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Page>
      <PageHeader
        title={<>Categories</>}
        description={
          <>
            Manage the consumer browse taxonomy. Categories are tree-shaped — drop sub-categories
            under a top-level for fine-grained navigation. Listings always reference a leaf.
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(allParentIds)}
              disabled={allParentIds.size === 0}
            >
              Expand all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(new Set())}
              disabled={expanded.size === 0}
            >
              Collapse all
            </Button>
            <Button
              variant="ink"
              caps
              iconLeft={<Plus className="size-3.5" />}
              onClick={() => setCreating({ parent: null })}
            >
              New top-level
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-px border-y border-rule">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load categories."
          action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
        />
      ) : tree.length === 0 ? (
        <Empty
          kicker="Empty taxonomy"
          title="No categories yet."
          description="Add a top-level category to start the consumer browse."
          action={
            <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setCreating({ parent: null })}>
              New category
            </Button>
          }
        />
      ) : (
        <ul className="border-y border-rule divide-y divide-rule">
          {tree.flatMap((node) =>
            renderNode(node, {
              expanded,
              onToggle: toggleExpand,
              onAddChild: (parent) => setCreating({ parent }),
              onEdit: setEditing,
              onDelete: setDeleting,
            }),
          )}
        </ul>
      )}

      <CreateOrEditDialog
        target={editing}
        creatingParent={creating?.parent ?? undefined}
        open={Boolean(creating || editing)}
        onClose={() => {
          setCreating(null);
          setEditing(null);
        }}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
        }}
        existing={data ?? []}
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

// ── Tree rendering ────────────────────────────────────────────────

function renderNode(
  node: TreeNode,
  ctx: {
    expanded: Set<string>;
    onToggle: (id: string) => void;
    onAddChild: (parent: CategoryRow) => void;
    onEdit: (c: CategoryRow) => void;
    onDelete: (c: CategoryRow) => void;
  },
): React.ReactNode[] {
  const isExpanded = ctx.expanded.has(node.id);
  const isLeaf = node.children.length === 0;
  const out: React.ReactNode[] = [
    <li key={node.id} className="grid grid-cols-12 items-center gap-3 px-3 py-3 hover:bg-surface/40">
      <div className="col-span-7 flex min-w-0 items-center gap-2">
        <span style={{ width: node.depth * 20 }} aria-hidden />
        {isLeaf ? (
          <span className="grid size-7 place-items-center text-ink-3" aria-hidden>
            <Folder className="size-4" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => ctx.onToggle(node.id)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            className="grid size-7 place-items-center rounded-xs text-ink-2 hover:bg-paper-2 hover:text-ink"
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        )}
        <span
          className="size-7 shrink-0 rounded-xs border border-ink/10"
          style={{ background: node.tintColor ?? 'transparent' }}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-ink">{node.label}</span>
            {!node.isActive && <Badge tone="neutral">Hidden</Badge>}
            {!isLeaf && (
              <span className="kicker text-ink-3">
                {node.children.length} sub-categor{node.children.length === 1 ? 'y' : 'ies'}
              </span>
            )}
          </div>
          <div className="font-mono text-[11.5px] text-ink-3">/{node.slug}</div>
        </div>
      </div>
      <div className="col-span-2 text-right font-mono text-[12.5px] text-ink-3">
        <span className="kicker mr-2">Listings</span>
        {node.listingCount}
      </div>
      <div className="col-span-1 text-right">
        <Badge tone={node.gender === 'her' ? 'info' : node.gender === 'him' ? 'info' : 'neutral'}>
          {node.gender.toUpperCase()}
        </Badge>
      </div>
      <div className="col-span-2 flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Plus className="size-3.5" />}
          onClick={() => ctx.onAddChild(node)}
        >
          Sub
        </Button>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Edit3 className="size-3.5" />}
          onClick={() => ctx.onEdit(node)}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Trash2 className="size-3.5 text-danger" />}
          onClick={() => ctx.onDelete(node)}
        />
      </div>
    </li>,
  ];

  if (!isLeaf && isExpanded) {
    out.push(...node.children.flatMap((c) => renderNode(c, ctx)));
  }
  return out;
}

// ── Create / Edit dialog ───────────────────────────────────────────

function CreateOrEditDialog({
  target,
  creatingParent,
  open,
  onClose,
  onSaved,
  existing,
}: {
  target: CategoryRow | null;
  creatingParent?: CategoryRow | undefined;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing: CategoryRow[];
}) {
  const isEdit = Boolean(target);
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [label, setLabel] = useState('');
  const [gender, setGender] = useState<Gender>('unisex');
  const [parentId, setParentId] = useState<string | null>(null);
  const [iconName, setIconName] = useState('');
  const [tintColor, setTintColor] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-hydrate when the dialog opens
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSlugTouched(Boolean(target));
    if (target) {
      setSlug(target.slug);
      setLabel(target.label);
      setGender(target.gender);
      setParentId(target.parentId ?? null);
      setIconName(target.iconName ?? '');
      setTintColor(target.tintColor ?? '');
      setImageUrl(target.imageUrl ?? '');
      setIsActive(target.isActive);
    } else {
      setSlug('');
      setLabel('');
      setGender(creatingParent?.gender ?? 'unisex');
      setParentId(creatingParent?.id ?? null);
      setIconName('');
      setTintColor('');
      setImageUrl('');
      setIsActive(true);
    }
  }, [open, target, creatingParent]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        slug: slug.trim(),
        label: label.trim(),
        gender,
        parentId,
        ...(iconName.trim() ? { iconName: iconName.trim() } : isEdit ? { iconName: null } : {}),
        ...(tintColor ? { tintColor } : isEdit ? { tintColor: null } : {}),
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : isEdit ? { imageUrl: null } : {}),
        isActive,
      };
      return target
        ? api<Category>(`/admin/categories/${target.id}`, { method: 'PATCH', body })
        : api<Category>('/admin/categories', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success(target ? 'Category updated' : 'Category created');
      onClose();
      onSaved();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Save failed';
      setError(msg);
      toast.error(msg);
    },
  });

  // Parent options exclude the target itself and its descendants (no cycles).
  const parentOptions = useMemo(() => {
    const banned = new Set<string>();
    if (target) {
      banned.add(target.id);
      const stack = [target.id];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const c of existing) {
          if (c.parentId === cur && !banned.has(c.id)) {
            banned.add(c.id);
            stack.push(c.id);
          }
        }
      }
    }
    return existing.filter((c) => !banned.has(c.id));
  }, [existing, target]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${target?.label}` : creatingParent ? `Add sub-category under ${creatingParent.label}` : 'New top-level category'}</DialogTitle>
          <DialogDescription>
            Slug is the URL identifier (must be unique). Tint colour theme-tints the consumer card.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!label.trim()) return setError('Label is required.');
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
              <Label htmlFor="kLabel" required>Label</Label>
              <Input
                id="kLabel"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </div>
            <div>
              <Label htmlFor="kSlug" required hint="lowercase, hyphens">Slug</Label>
              <Input
                id="kSlug"
                mono
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase());
                  setSlugTouched(true);
                }}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="kParent">Parent</Label>
              <Select
                value={parentId ?? '__none__'}
                onValueChange={(v) => setParentId(v === '__none__' ? null : v)}
              >
                <SelectTrigger id="kParent"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Top-level —</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kGender" required>Audience</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                <SelectTrigger id="kGender"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="her">HER</SelectItem>
                  <SelectItem value="him">HIM</SelectItem>
                  <SelectItem value="unisex">Unisex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="kIcon" hint="ionicons name (e.g. shirt-outline)">Icon</Label>
              <Input id="kIcon" mono value={iconName} onChange={(e) => setIconName(e.target.value)} />
            </div>
            <div>
              <Label hint="theme-tint on the consumer card">Tint colour</Label>
              <ColorPicker value={tintColor} onChange={setTintColor} placeholder="No tint" />
            </div>
          </div>

          <div>
            <Label htmlFor="kImg" hint="optional · hosted URL">Image URL</Label>
            <Input id="kImg" mono value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://cdn.example.com/photo.jpg" />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="kActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 accent-ink"
            />
            <label htmlFor="kActive" className="text-[13.5px] text-ink-2">
              Active — show in consumer-app browse
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
  target: CategoryRow | null;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {target?.label}?</DialogTitle>
          <DialogDescription>
            {target && target.listingCount > 0 ? (
              <>
                This category currently has <strong className="text-ink">{target.listingCount}</strong>{' '}
                listing{target.listingCount === 1 ? '' : 's'} referencing it. The server will refuse the
                delete until those listings are re-categorised.
              </>
            ) : (
              <>
                The category record will be removed permanently. Listings already use a category,
                so deletion is only allowed when no listings reference it.
              </>
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
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function buildTree(rows: CategoryRow[]): TreeNode[] {
  const byParent = new Map<string | null, CategoryRow[]>();
  for (const r of rows) {
    const k = r.parentId ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(r);
  }
  function attach(parentId: string | null, depth: number): TreeNode[] {
    const list = byParent.get(parentId) ?? [];
    return list
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
      .map((r) => ({ ...r, depth, children: attach(r.id, depth + 1) }));
  }
  return attach(null, 0);
}

function hasChildren(id: string, rows: CategoryRow[]): boolean {
  return rows.some((r) => r.parentId === id);
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
