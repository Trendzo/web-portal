import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { Clock, GripVertical, ImageOff, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { hasStill, thumbUrl } from '@/lib/image';
import type {
  CmsAsset,
  CmsGender,
  CmsItem,
  CmsSectionDetail,
  CmsSectionSpec,
} from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { ItemDialog } from './item-dialog';

/**
 * One CMS section, edited generically.
 *
 * There is exactly one of these for all twenty-odd sections. Everything specific — which copy
 * lines a section has, which fields its items carry, whether it splits by rail, how many items
 * it holds — comes from the spec the backend serves. A new section therefore costs one schema
 * entry and no admin code.
 *
 * Edits land in the DRAFT immediately and are invisible to customers; the Publish tab is what
 * makes them live.
 */

const COPY_LABELS: Record<string, { label: string; hint?: string }> = {
  title: { label: 'Heading' },
  subtitle: { label: 'Sub-heading' },
  kicker: { label: 'Eyebrow' },
  ctaLabel: { label: 'Action label' },
};

export function SectionPanel({
  sectionKey,
  spec,
  routes,
  canEdit,
}: {
  sectionKey: string;
  spec: CmsSectionSpec;
  routes: string[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [rail, setRail] = useState<CmsGender>('her');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [target, setTarget] = useState<CmsItem | null>(null);
  const [order, setOrder] = useState<CmsItem[]>([]);

  const detail = useQuery({
    queryKey: ['admin', 'cms', 'section', sectionKey],
    queryFn: () => api<CmsSectionDetail>(`/admin/cms/sections/${sectionKey}`),
  });

  const assets = useQuery({
    queryKey: ['admin', 'cms', 'assets'],
    queryFn: () => api<{ assets: CmsAsset[]; categories: string[] }>('/admin/cms/assets'),
    staleTime: 5 * 60_000,
  });
  const previewByKey = useMemo(
    () => new Map((assets.data?.assets ?? []).map((a) => [a.key, a.previewUrl])),
    [assets.data],
  );

  // Items for the rail being edited. A gender-split section shows one rail at a time so the
  // drag order the operator sees is the order that rail actually renders in.
  const visible = useMemo(() => {
    const all = detail.data?.items ?? [];
    if (!spec.genderSplit) return all;
    return all.filter((i) => i.gender === rail || i.gender === 'all');
  }, [detail.data, spec.genderSplit, rail]);

  useEffect(() => setOrder(visible), [visible]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = useMutation({
    mutationFn: (itemIds: string[]) =>
      api<CmsItem[]>(`/admin/cms/sections/${sectionKey}/items/order`, {
        method: 'PUT',
        body: { itemIds },
      }),
    onSuccess: () => {
      toast.success('Order saved');
      void qc.invalidateQueries({ queryKey: ['admin', 'cms'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Reorder failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<{ id: string }>(`/admin/cms/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Item removed');
      void qc.invalidateQueries({ queryKey: ['admin', 'cms'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((i) => i.id === active.id);
    const newIndex = order.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    // The API demands the section's FULL item list — a partial one would leave the items this
    // rail is hiding at a stale sortOrder. Reassemble by taking the other rail's items in
    // their existing order and splicing the reordered ones back in.
    const all = detail.data?.items ?? [];
    const movedIds = new Set(next.map((i) => i.id));
    const others = all.filter((i) => !movedIds.has(i.id));
    reorder.mutate([...next, ...others].map((i) => i.id));
  }

  if (detail.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <p className="text-[13px] text-danger">
        Could not load “{spec.label}”. {detail.error instanceof ApiError ? detail.error.message : ''}
      </p>
    );
  }

  const { section } = detail.data;
  // Caps are per rail — a gender-split section holds both rails' items in one set, and only one
  // rail ever renders in the app. Counting them together would say "3/3 full" when HIM is empty.
  const railCount = spec.genderSplit
    ? detail.data.items.filter((i) => i.gender === rail || i.gender === 'all').length
    : detail.data.items.length;
  const atCapacity = railCount >= spec.maxItems;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-ink">{spec.label}</h3>
            {!section.isEnabled && <Badge tone="warning" flat>Hidden</Badge>}
            {spec.maxItems > 0 && (
              <span className="text-[11.5px] text-ink-3">
                {railCount}/{spec.maxItems}
                {spec.genderSplit ? ` on ${rail.toUpperCase()}` : ''}
              </span>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-3">
            {spec.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {spec.genderSplit && (
            <Segmented
              value={rail}
              onChange={(v) => setRail(v)}
              options={[
                { value: 'her' as CmsGender, label: 'HER' },
                { value: 'him' as CmsGender, label: 'HIM' },
              ]}
            />
          )}
          {canEdit && spec.maxItems > 0 && (
            <Button
              size="sm"
              variant="solid"
              iconLeft={<Plus className="size-3.5" />}
              disabled={atCapacity}
              title={
                atCapacity
                  ? `This section holds at most ${spec.maxItems}${spec.genderSplit ? ' per rail' : ''}`
                  : undefined
              }
              onClick={() => {
                setTarget(null);
                setDialogOpen(true);
              }}
            >
              Add
            </Button>
          )}
        </div>
      </header>

      <SectionCopyForm sectionKey={sectionKey} spec={spec} detail={detail.data} canEdit={canEdit} />

      {spec.maxItems === 0 ? null : order.length === 0 ? (
        <p className="rounded-md border border-dashed border-line p-6 text-center text-[13px] text-ink-3">
          Nothing here yet.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-rule rounded-md border border-line">
              {order.map((item, i) => (
                <SortableItemRow
                  key={item.id}
                  ord={i + 1}
                  item={item}
                  spec={spec}
                  canEdit={canEdit}
                  previewUrl={item.imageUrl ?? previewByKey.get(item.assetKey ?? '') ?? null}
                  onEdit={() => {
                    setTarget(item);
                    setDialogOpen(true);
                  }}
                  onRemove={() => remove.mutate(item.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sectionKey={sectionKey}
        spec={spec}
        routes={routes}
        target={target}
        defaultGender={spec.genderSplit ? rail : 'all'}
      />
    </section>
  );
}

/** Section-level copy + the enable switch. Saved on blur-free explicit submit. */
function SectionCopyForm({
  sectionKey,
  spec,
  detail,
  canEdit,
}: {
  sectionKey: string;
  spec: CmsSectionSpec;
  detail: CmsSectionDetail;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const { section } = detail;
  const [copy, setCopy] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setCopy({
      title: section.title ?? '',
      subtitle: section.subtitle ?? '',
      kicker: section.kicker ?? '',
      ctaLabel: section.ctaLabel ?? '',
    });
    setConfig(section.config ?? {});
    setEnabled(section.isEnabled);
  }, [section]);

  const save = useMutation({
    mutationFn: () =>
      api(`/admin/cms/sections/${sectionKey}`, {
        method: 'PATCH',
        body: {
          ...Object.fromEntries(
            spec.copyFields.map((f) => [f, copy[f]?.trim() ? copy[f] : null]),
          ),
          config,
          isEnabled: enabled,
        },
      }),
    onSuccess: () => {
      toast.success('Section saved');
      void qc.invalidateQueries({ queryKey: ['admin', 'cms'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  if (spec.copyFields.length === 0 && spec.configFields.length === 0) {
    // Nothing section-level to edit, but the visibility switch still applies.
    return canEdit ? (
      <div className="flex items-center justify-between rounded-md border border-line p-3">
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Section visible in the app
        </label>
        <Button size="sm" variant="outline" loading={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </div>
    ) : null;
  }

  return (
    <form
      className="space-y-3 rounded-md border border-line p-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {spec.copyFields.map((f) => {
          const meta = COPY_LABELS[f] ?? { label: f };
          const isLong = f === 'subtitle';
          return (
            <div key={f} className={isLong ? 'sm:col-span-2' : undefined}>
              <Label htmlFor={`cms-copy-${f}`}>{meta.label}</Label>
              {isLong ? (
                <Textarea
                  id={`cms-copy-${f}`}
                  rows={2}
                  disabled={!canEdit}
                  value={copy[f] ?? ''}
                  onChange={(e) => setCopy((p) => ({ ...p, [f]: e.target.value }))}
                />
              ) : (
                <Input
                  id={`cms-copy-${f}`}
                  disabled={!canEdit}
                  value={copy[f] ?? ''}
                  onChange={(e) => setCopy((p) => ({ ...p, [f]: e.target.value }))}
                />
              )}
              {f === 'title' && (
                <p className="mt-1 text-[11px] text-ink-3">
                  A newline splits the heading across lines where the layout supports it.
                </p>
              )}
            </div>
          );
        })}

        {spec.configFields.map((f) => {
          const raw = config[f.key];
          return (
            <div key={f.key} className={f.kind === 'textarea' ? 'sm:col-span-2' : undefined}>
              <Label htmlFor={`cms-cfg-${f.key}`} {...(f.help ? { hint: f.help } : {})}>
                {f.label}
              </Label>
              {f.kind === 'textarea' ? (
                <Textarea
                  id={`cms-cfg-${f.key}`}
                  rows={2}
                  disabled={!canEdit}
                  value={typeof raw === 'string' ? raw : ''}
                  onChange={(e) => setConfig((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              ) : f.kind === 'number' ? (
                <Input
                  id={`cms-cfg-${f.key}`}
                  type="number"
                  disabled={!canEdit}
                  value={typeof raw === 'number' ? String(raw) : ''}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      [f.key]: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                />
              ) : (
                <Input
                  id={`cms-cfg-${f.key}`}
                  disabled={!canEdit}
                  value={typeof raw === 'string' ? raw : ''}
                  onChange={(e) => setConfig((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Section visible in the app
          </label>
          <Button type="submit" size="sm" variant="outline" loading={save.isPending}>
            Save section
          </Button>
        </div>
      )}
    </form>
  );
}

function SortableItemRow({
  ord,
  item,
  spec,
  canEdit,
  previewUrl,
  onEdit,
  onRemove,
}: {
  ord: number;
  item: CmsItem;
  spec: CmsSectionSpec;
  canEdit: boolean;
  previewUrl: string | null;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const primary =
    (typeof item.content.label === 'string' && item.content.label) ||
    (typeof item.content.title === 'string' && item.content.title) ||
    (typeof item.content.tag === 'string' && item.content.tag) ||
    item.key;

  const scheduled = item.startsAt || item.endsAt;

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-3 px-3 py-2.5">
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="grid size-7 shrink-0 cursor-grab place-items-center text-ink-3 hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-6 shrink-0 font-mono text-[11px] text-ink-3">
        {String(ord).padStart(2, '0')}
      </span>

      {spec.media !== 'none' && (
        <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded border border-line bg-bg-3">
          {hasStill(previewUrl, spec.media === 'video' ? 'video' : 'image') ? (
            <img
              src={thumbUrl(previewUrl, 96, spec.media === 'video' ? 'video' : 'image') ?? ''}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <ImageOff className="size-3.5 text-ink-3" />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-ink">{primary}</span>
          {spec.genderSplit && item.gender !== 'all' && (
            <Badge tone="neutral" flat>
              {item.gender.toUpperCase()}
            </Badge>
          )}
          {!item.isEnabled && <Badge tone="warning" flat>Off</Badge>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
          <code className="truncate">{item.key}</code>
          {scheduled && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {item.startsAt ? new Date(item.startsAt).toLocaleDateString() : '—'}
              {' → '}
              {item.endsAt ? new Date(item.endsAt).toLocaleDateString() : '—'}
            </span>
          )}
          {item.cities && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {item.cities.length ? item.cities.join(', ') : 'nowhere'}
            </span>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove"
            className={cn('text-ink-3 hover:text-danger')}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </li>
  );
}
