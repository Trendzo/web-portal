/**
 * Spin & Win — admin configuration.
 *
 * What this page deliberately does NOT do: express discount rules. A prize slice points at
 * a promotion that already exists, and that promotion carries min order value,
 * first-order-only, per-consumer limit, tier filter, store scope and expiry. Those are
 * shown read-only on the slice so the operator can see what they attached, but they are
 * edited on the promotion — one rules engine, one place to change a rule.
 */
import { useEffect, useMemo, useState } from 'react';
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
import { GripVertical, Pause, Play, Plus, Save, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePermission } from '@/lib/use-permission';

// ── Types (mirror the admin API) ──────────────────────────────────

type RewardKind = 'promotion' | 'points' | 'none';
type WheelStatus = 'draft' | 'active' | 'paused' | 'archived';

type PrizePromotion = {
  id: string;
  name: string;
  mechanism: string;
  discountType: string;
  config: Record<string, unknown> | null;
  scope: Record<string, unknown> | null;
  status: string;
  perConsumerLimit: number | null;
  validUntil: string;
};

type Segment = {
  id: string;
  sortOrder: number;
  label: string;
  sublabel: string | null;
  icon: string | null;
  colorHex: string | null;
  weightBp: number;
  rewardKind: RewardKind;
  promotionId: string | null;
  points: number | null;
  stockTotal: number | null;
  stockIssued: number;
  promotion?: PrizePromotion | null;
};

type Wheel = {
  id: string;
  name: string;
  status: WheelStatus;
  surface: 'popup' | 'screen' | 'both';
  spinsPerDevicePerDay: number;
  maxClaimsPerConsumer: number | null;
  guestSpinAllowed: boolean;
  claimWindowHours: number;
  validFrom: string;
  validUntil: string;
  segmentCount?: number;
  segments?: Segment[];
  stats?: { spins: number; claimed: number };
};

const QK = ['admin', 'spin-wheels'] as const;

const STATUS_TONE: Record<WheelStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  draft: 'neutral',
  archived: 'neutral',
};

const pct = (bp: number) => `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
const toLocalInput = (iso: string) => new Date(iso).toISOString().slice(0, 16);

/** A row in the editor, before it has an id from the server. */
type DraftSegment = Omit<Segment, 'id' | 'sortOrder' | 'stockIssued' | 'promotion'> & {
  key: string;
  stockIssued?: number;
};

let keySeq = 0;
const newKey = () => `seg-${keySeq++}`;

const blankSegment = (): DraftSegment => ({
  key: newKey(),
  label: 'PRIZE',
  sublabel: null,
  icon: null,
  colorHex: null,
  weightBp: 0,
  rewardKind: 'none',
  promotionId: null,
  points: null,
  stockTotal: null,
});

export default function AdminSpinWheel() {
  const qc = useQueryClient();
  const canEdit = usePermission('promotions.create');
  const canPublish = usePermission('promotions.publish');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useQuery({ queryKey: QK, queryFn: () => api<Wheel[]>('/admin/spin-wheels') });

  // Land on the live wheel by default — the one an operator almost always wants.
  useEffect(() => {
    if (selectedId || !list.data?.length) return;
    setSelectedId((list.data.find((w) => w.status === 'active') ?? list.data[0])!.id);
  }, [list.data, selectedId]);

  const detail = useQuery({
    queryKey: [...QK, selectedId],
    queryFn: () => api<Wheel>(`/admin/spin-wheels/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; action: 'activate' | 'pause' }) =>
      api<Wheel>(`/admin/spin-wheels/${v.id}/${v.action}`, { method: 'POST' }),
    onSuccess: (_r, v) => {
      toast.success(v.action === 'activate' ? 'Wheel is live' : 'Wheel paused');
      void qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not change status'),
  });

  return (
    <Page>
      <PageHeader
        title={<>Spin &amp; Win</>}
        description={
          <>
            A prize slice hands out an existing promotion as a single-use code, so every
            eligibility rule — minimum order, new customers only, one per customer — lives on
            that promotion and is enforced at checkout. Shoppers can spin without an account;
            they have to sign in to collect.
          </>
        }
        actions={
          canEdit ? (
            <Button
              variant="ink"
              caps
              iconLeft={<Plus className="size-3.5" />}
              onClick={() => setCreating(true)}
            >
              New wheel
            </Button>
          ) : undefined
        }
      />

      {list.isLoading ? (
        <div className="space-y-px border-y border-rule">
          {[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : list.isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load wheels."
          action={<Button variant="outline" onClick={() => list.refetch()}>Retry</Button>}
        />
      ) : (list.data ?? []).length === 0 ? (
        <Empty
          kicker="Nothing running"
          title="No wheels yet."
          action={
            canEdit ? (
              <Button variant="ink" caps onClick={() => setCreating(true)}>
                New wheel
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="border-y border-rule divide-y divide-rule">
          {(list.data ?? []).map((w) => (
            <li
              key={w.id}
              className={
                'grid grid-cols-12 items-center gap-4 px-3 py-3 ' +
                (w.id === selectedId ? 'bg-bg-2' : '')
              }
            >
              <button
                type="button"
                className="col-span-5 text-left"
                onClick={() => setSelectedId(w.id)}
              >
                <div className="font-medium text-ink">{w.name}</div>
                <div className="kicker mt-0.5 text-ink-3">
                  {w.segmentCount ?? 0} slices
                  <span className="mx-1.5 text-ink-4">·</span>
                  {w.surface}
                  <span className="mx-1.5 text-ink-4">·</span>
                  {w.guestSpinAllowed ? 'guests may spin' : 'sign-in required'}
                </div>
              </button>
              <div className="col-span-2">
                <Badge tone={STATUS_TONE[w.status]}>{w.status}</Badge>
              </div>
              <div className="col-span-3 font-mono text-[12.5px] text-ink-3">
                {w.stats?.spins ?? 0} spins · {w.stats?.claimed ?? 0} claimed
              </div>
              <div className="col-span-2 text-right">
                {canPublish &&
                  (w.status === 'active' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<Pause className="size-3.5" />}
                      disabled={toggle.isPending && toggle.variables?.id === w.id}
                      onClick={() => toggle.mutate({ id: w.id, action: 'pause' })}
                    >
                      Pause
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<Play className="size-3.5" />}
                      disabled={
                        w.status === 'archived' ||
                        (toggle.isPending && toggle.variables?.id === w.id)
                      }
                      onClick={() => toggle.mutate({ id: w.id, action: 'activate' })}
                    >
                      Go live
                    </Button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {detail.data && (
        <div className="mt-10 space-y-10">
          <WheelSettings wheel={detail.data} canEdit={canEdit} />
          <SegmentEditor wheel={detail.data} canEdit={canEdit} />
        </div>
      )}

      <CreateWheelDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setSelectedId(id);
          void qc.invalidateQueries({ queryKey: QK });
        }}
      />
    </Page>
  );
}

// ── Global knobs ──────────────────────────────────────────────────

/**
 * Draft-and-diff, the same shape as the fees panel: local state seeded from the server,
 * Save enabled only when something actually changed, and only changed keys sent.
 */
function WheelSettings({ wheel, canEdit }: { wheel: Wheel; canEdit: boolean }) {
  const qc = useQueryClient();
  const seed = useMemo(
    () => ({
      name: wheel.name,
      surface: wheel.surface,
      spinsPerDevicePerDay: wheel.spinsPerDevicePerDay,
      maxClaimsPerConsumer: wheel.maxClaimsPerConsumer,
      guestSpinAllowed: wheel.guestSpinAllowed,
      claimWindowHours: wheel.claimWindowHours,
      validFrom: toLocalInput(wheel.validFrom),
      validUntil: toLocalInput(wheel.validUntil),
    }),
    [wheel],
  );
  const [draft, setDraft] = useState(seed);
  useEffect(() => setDraft(seed), [seed]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(seed);
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      api<Wheel>(`/admin/spin-wheels/${wheel.id}`, {
        method: 'PATCH',
        body: {
          ...draft,
          validFrom: new Date(draft.validFrom).toISOString(),
          validUntil: new Date(draft.validUntil).toISOString(),
        },
      }),
    onSuccess: () => {
      toast.success('Settings saved');
      void qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  return (
    <section>
      <SectionHeading
        title="Settings"
        hint={wheel.status === 'active' ? 'Changes apply to the live wheel immediately' : undefined}
      />
      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <Label required>Name</Label>
            <Input
              value={draft.name}
              disabled={!canEdit}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          <div>
            <Label hint="where it appears">Surface</Label>
            <select
              className="h-9 w-full rounded-md border border-line-2 bg-bg px-3 text-[13.5px] text-ink disabled:opacity-60"
              value={draft.surface}
              disabled={!canEdit}
              onChange={(e) => set('surface', e.target.value as Wheel['surface'])}
            >
              <option value="both">Popup and screen</option>
              <option value="popup">Popup only</option>
              <option value="screen">Screen only</option>
            </select>
          </div>

          <div>
            <Label required hint="per device, per day">Spins allowed</Label>
            <Input
              mono
              type="number"
              min={1}
              max={50}
              value={draft.spinsPerDevicePerDay}
              disabled={!canEdit}
              onChange={(e) => set('spinsPerDevicePerDay', Number(e.target.value))}
            />
          </div>

          <div>
            <Label hint="lifetime, per account — blank for unlimited">Prizes per customer</Label>
            <Input
              mono
              type="number"
              min={1}
              max={100}
              value={draft.maxClaimsPerConsumer ?? ''}
              disabled={!canEdit}
              onChange={(e) =>
                set('maxClaimsPerConsumer', e.target.value === '' ? null : Number(e.target.value))
              }
            />
            <p className="mt-1 text-[11.5px] text-ink-3">
              The cap that actually protects the budget. A device id resets when the app is
              reinstalled; an account does not.
            </p>
          </div>

          <div>
            <Label required hint="hours to sign in and collect">Claim window</Label>
            <Input
              mono
              type="number"
              min={1}
              max={8760}
              value={draft.claimWindowHours}
              disabled={!canEdit}
              onChange={(e) => set('claimWindowHours', Number(e.target.value))}
            />
          </div>

          <div>
            <Label required>Starts</Label>
            <Input
              type="datetime-local"
              value={draft.validFrom}
              disabled={!canEdit}
              onChange={(e) => set('validFrom', e.target.value)}
            />
          </div>

          <div>
            <Label required>Ends</Label>
            <Input
              type="datetime-local"
              value={draft.validUntil}
              disabled={!canEdit}
              onChange={(e) => set('validUntil', e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 self-end pb-1">
            <input
              id="guestSpin"
              type="checkbox"
              className="size-4 accent-ink"
              checked={draft.guestSpinAllowed}
              disabled={!canEdit}
              onChange={(e) => set('guestSpinAllowed', e.target.checked)}
            />
            <label htmlFor="guestSpin" className="text-[13.5px] text-ink">
              Let signed-out visitors spin
            </label>
          </div>

          {canEdit && (
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 border-t border-rule pt-4">
              <Button variant="outline" disabled={!dirty} onClick={() => setDraft(seed)}>
                Reset
              </Button>
              <Button
                variant="ink"
                caps
                iconLeft={<Save className="size-3.5" />}
                disabled={!dirty || save.isPending}
                onClick={() => save.mutate()}
              >
                Save settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// ── Slice editor ──────────────────────────────────────────────────

function SegmentEditor({ wheel, canEdit }: { wheel: Wheel; canEdit: boolean }) {
  const qc = useQueryClient();
  const seed = useMemo<DraftSegment[]>(
    () =>
      (wheel.segments ?? []).map((s) => ({
        key: s.id,
        label: s.label,
        sublabel: s.sublabel,
        icon: s.icon,
        colorHex: s.colorHex,
        weightBp: s.weightBp,
        rewardKind: s.rewardKind,
        promotionId: s.promotionId,
        points: s.points,
        stockTotal: s.stockTotal,
        stockIssued: s.stockIssued,
      })),
    [wheel.segments],
  );
  const [items, setItems] = useState<DraftSegment[]>(seed);
  useEffect(() => setItems(seed), [seed]);

  const candidates = useQuery({
    queryKey: [...QK, 'prize-candidates'],
    queryFn: () => api<PrizePromotion[]>('/admin/spin-wheels/prize-candidates'),
  });

  const total = items.reduce((sum, s) => sum + (s.weightBp || 0), 0);
  const balanced = total === 10_000;
  const dirty = JSON.stringify(items) !== JSON.stringify(seed);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.key === active.id);
    const to = items.findIndex((i) => i.key === over.id);
    if (from < 0 || to < 0) return;
    setItems(arrayMove(items, from, to));
  }

  const patch = (key: string, p: Partial<DraftSegment>) =>
    setItems((list) => list.map((s) => (s.key === key ? { ...s, ...p } : s)));

  const save = useMutation({
    mutationFn: () =>
      api<Segment[]>(`/admin/spin-wheels/${wheel.id}/segments`, {
        method: 'PUT',
        body: {
          segments: items.map((s) => ({
            label: s.label,
            sublabel: s.sublabel || null,
            icon: s.icon || null,
            colorHex: s.colorHex || null,
            weightBp: s.weightBp,
            rewardKind: s.rewardKind,
            promotionId: s.rewardKind === 'promotion' ? s.promotionId : null,
            points: s.rewardKind === 'points' ? s.points : null,
            stockTotal: s.stockTotal,
          })),
        },
      }),
    onSuccess: () => {
      toast.success('Slices saved');
      void qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  /** Spread the remainder over the slices so the operator does not have to do the arithmetic. */
  const evenOut = () => {
    if (items.length === 0) return;
    const each = Math.floor(10_000 / items.length);
    const rest = 10_000 - each * items.length;
    setItems(items.map((s, i) => ({ ...s, weightBp: each + (i === 0 ? rest : 0) })));
  };

  return (
    <section>
      <SectionHeading
        title="Slices"
        hint={
          <span className={balanced ? 'text-ink-3' : 'text-danger'}>
            Odds total {pct(total)}
            {balanced ? '' : ' — must be exactly 100%'}
          </span>
        }
      />

      {items.length === 0 ? (
        <Empty kicker="Empty wheel" title="Add at least two slices." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
            <ul className="border-y border-rule divide-y divide-rule">
              {items.map((s, i) => (
                <SortableSegmentRow
                  key={s.key}
                  ord={i + 1}
                  seg={s}
                  canEdit={canEdit}
                  candidates={candidates.data ?? []}
                  onPatch={(p) => patch(s.key, p)}
                  onRemove={() => setItems(items.filter((x) => x.key !== s.key))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Plus className="size-3.5" />}
              disabled={items.length >= 12}
              onClick={() => setItems([...items, blankSegment()])}
            >
              Add slice
            </Button>
            <Button variant="ghost" size="sm" onClick={evenOut}>
              Even out the odds
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={!dirty} onClick={() => setItems(seed)}>
              Reset
            </Button>
            <Button
              variant="ink"
              caps
              iconLeft={<Save className="size-3.5" />}
              disabled={!dirty || !balanced || items.length < 2 || save.isPending}
              onClick={() => save.mutate()}
            >
              Save slices
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Human summary of the eligibility a promotion already carries. Read-only by design. */
function promoRules(p: PrizePromotion | undefined): string[] {
  if (!p) return [];
  const cfg = (p.config ?? {}) as Record<string, number | undefined>;
  const scope = (p.scope ?? {}) as Record<string, unknown>;
  const out: string[] = [];
  if (cfg.minCartPaise) out.push(`min ₹${Math.round(cfg.minCartPaise / 100)}`);
  if (cfg.minOrderPaise) out.push(`min ₹${Math.round(cfg.minOrderPaise / 100)}`);
  if (scope.firstOrderOnly) out.push('new customers only');
  if (p.perConsumerLimit === 1) out.push('one per customer');
  else if (p.perConsumerLimit) out.push(`${p.perConsumerLimit} per customer`);
  if (Array.isArray(scope.loyaltyTierFilter) && scope.loyaltyTierFilter.length) {
    out.push(`${(scope.loyaltyTierFilter as string[]).join('/')} tier`);
  }
  if (Array.isArray(scope.storeIds) && scope.storeIds.length) out.push('selected stores');
  out.push(`until ${new Date(p.validUntil).toLocaleDateString()}`);
  return out;
}

function SortableSegmentRow({
  ord,
  seg,
  canEdit,
  candidates,
  onPatch,
  onRemove,
}: {
  ord: number;
  seg: DraftSegment;
  canEdit: boolean;
  candidates: PrizePromotion[];
  onPatch: (p: Partial<DraftSegment>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: seg.key,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const promo = candidates.find((c) => c.id === seg.promotionId);
  const rules = promoRules(promo);
  const spent = seg.stockTotal !== null && (seg.stockIssued ?? 0) >= seg.stockTotal;

  return (
    <li ref={setNodeRef} style={style} className="px-3 py-4">
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 pt-2">
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

        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label required>Label</Label>
            <Input
              value={seg.label}
              disabled={!canEdit}
              maxLength={24}
              onChange={(e) => onPatch({ label: e.target.value })}
            />
          </div>
          <div>
            <Label hint="second line">Sub-label</Label>
            <Input
              value={seg.sublabel ?? ''}
              disabled={!canEdit}
              maxLength={24}
              onChange={(e) => onPatch({ sublabel: e.target.value || null })}
            />
          </div>
          <div>
            <Label required hint="bp (10000 = 100%)">Odds</Label>
            <Input
              mono
              type="number"
              min={0}
              max={10000}
              value={seg.weightBp}
              disabled={!canEdit}
              onChange={(e) => onPatch({ weightBp: Number(e.target.value) })}
            />
            <p className="mt-1 font-mono text-[11px] text-ink-3">{pct(seg.weightBp || 0)}</p>
          </div>
          <div>
            <Label hint="total ever — blank for unlimited">Stock</Label>
            <Input
              mono
              type="number"
              min={0}
              value={seg.stockTotal ?? ''}
              disabled={!canEdit}
              onChange={(e) =>
                onPatch({ stockTotal: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
            {seg.stockTotal !== null && (
              <p className="mt-1 font-mono text-[11px] text-ink-3">
                {seg.stockIssued ?? 0} / {seg.stockTotal} given out
              </p>
            )}
          </div>

          <div>
            <Label required>Prize</Label>
            <select
              className="h-9 w-full rounded-md border border-line-2 bg-bg px-3 text-[13.5px] text-ink disabled:opacity-60"
              value={seg.rewardKind}
              disabled={!canEdit}
              onChange={(e) =>
                onPatch({
                  rewardKind: e.target.value as RewardKind,
                  promotionId: null,
                  points: null,
                })
              }
            >
              <option value="promotion">A promotion (coupon code)</option>
              <option value="points">Loyalty points</option>
              <option value="none">Nothing — better luck next time</option>
            </select>
          </div>

          {seg.rewardKind === 'promotion' && (
            <div className="lg:col-span-3">
              <Label required>Which promotion</Label>
              <select
                className="h-9 w-full rounded-md border border-line-2 bg-bg px-3 text-[13.5px] text-ink disabled:opacity-60"
                value={seg.promotionId ?? ''}
                disabled={!canEdit}
                onChange={(e) => onPatch({ promotionId: e.target.value || null })}
              >
                <option value="">Pick one…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.discountType}
                  </option>
                ))}
              </select>
              {rules.length > 0 && (
                <p className="mt-1.5 text-[11.5px] text-ink-3">
                  Rules on this promotion: {rules.join(' · ')}. Edit them on the promotion
                  itself.
                </p>
              )}
            </div>
          )}

          {seg.rewardKind === 'points' && (
            <div>
              <Label required hint="points">How many</Label>
              <Input
                mono
                type="number"
                min={1}
                value={seg.points ?? ''}
                disabled={!canEdit}
                onChange={(e) => onPatch({ points: Number(e.target.value) || null })}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 pt-1">
          {spent && <Badge tone="warning">sold out</Badge>}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Trash2 className="size-3.5" />}
              onClick={onRemove}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

// ── Create ────────────────────────────────────────────────────────

function CreateWheelDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setError(null);
  }, [open]);

  const create = useMutation({
    mutationFn: () => {
      const now = Date.now();
      return api<Wheel>('/admin/spin-wheels', {
        method: 'POST',
        body: {
          name: name.trim(),
          surface: 'both',
          spinsPerDevicePerDay: 1,
          maxClaimsPerConsumer: 1,
          guestSpinAllowed: true,
          claimWindowHours: 168,
          validFrom: new Date(now).toISOString(),
          validUntil: new Date(now + 30 * 86_400_000).toISOString(),
        },
      });
    },
    onSuccess: (w) => {
      toast.success('Wheel created as a draft — add slices, then go live');
      onCreated(w.id);
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Could not create the wheel';
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New wheel</DialogTitle>
          <DialogDescription>
            Starts as a draft running for 30 days, one spin per device per day, one prize per
            customer. Add the slices, then take it live.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return setError('Give it a name.');
            create.mutate();
          }}
          className="space-y-5"
          noValidate
        >
          <div>
            <Label htmlFor="wName" required>Name</Label>
            <Input
              id="wName"
              value={name}
              placeholder="Welcome Wheel"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="ink" caps disabled={create.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
