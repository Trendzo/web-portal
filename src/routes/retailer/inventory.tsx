import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Download,
  FileWarning,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { api, ApiError, BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  LOW_STOCK_THRESHOLD,
  availableOf,
  importReasonLabel,
  parseInventoryCsv,
  stockToneOf,
  type ParsedImportRow,
  type ParseError,
} from '@/lib/inventory';
import { listingStatusMeta, formatPaise } from '@/lib/status';
import type {
  InventoryAdjustment,
  InventoryImportResult,
  InventoryRow,
  ListingStatus,
  Variant,
} from '@/lib/types';
import { cn } from '@/lib/cn';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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

type StatusFilter = ListingStatus | 'all';
type FlagFilter = 'all' | 'low' | 'out';

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'retired', label: 'Retired' },
];

export default function RetailerInventory() {
  // The Products page deep-links here with `?q=<sku>` so the relevant variant is
  // already filtered. We seed `q` from the URL once, then own it locally — typing
  // afterwards doesn't churn the URL.
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [flag, setFlag] = useState<FlagFilter>('all');
  const [importOpen, setImportOpen] = useState(false);

  const inventory = useQuery({
    queryKey: ['retailer', 'inventory'],
    queryFn: () => api<InventoryRow[]>('/retailer/inventory'),
  });

  const all = inventory.data ?? [];

  // Pre-compute aggregate stats once per fetch — drives the header tiles AND the
  // counts on the flag-filter pills, so they stay consistent.
  const stats = useMemo(() => {
    let totalVariants = 0;
    let totalStock = 0;
    let lowCount = 0;
    let outCount = 0;
    for (const r of all) {
      totalVariants += 1;
      totalStock += r.stock;
      const tone = stockToneOf(r);
      if (tone === 'out') outCount += 1;
      else if (tone === 'low') lowCount += 1;
    }
    return { totalVariants, totalStock, lowCount, outCount };
  }, [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((r) => {
      if (status !== 'all' && r.listingStatus !== status) return false;
      if (flag === 'low' && stockToneOf(r) !== 'low') return false;
      if (flag === 'out' && stockToneOf(r) !== 'out') return false;
      if (needle) {
        const haystack = `${r.listingName} ${r.brandName ?? ''} ${r.sku ?? ''} ${r.attributesLabel}`
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, status, flag]);

  return (
    <Page>
      <PageHeader
        title="Inventory"
        description={
          <>
            Stock counts across every variant in your catalog. Edit inline, or upload a
            CSV to update many SKUs at once.
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Download className="size-3.5" />}
              onClick={() => downloadInventoryCsv()}
            >
              Export
            </Button>
            <Button
              variant="ink"
              caps
              size="sm"
              iconLeft={<Upload className="size-3.5" />}
              onClick={() => setImportOpen(true)}
            >
              Import
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">

      {/* Stat tiles. Fixed-grid so the four numbers stay aligned regardless of
          width — a quick scan of the row tells the operator the state of the catalog
          before they even touch the table. */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Variants" value={stats.totalVariants} />
        <StatTile label="Units on hand" value={stats.totalStock} />
        <StatTile label="Low stock" value={stats.lowCount} tone={stats.lowCount > 0 ? 'warning' : 'neutral'} />
        <StatTile label="Out of stock" value={stats.outCount} tone={stats.outCount > 0 ? 'danger' : 'neutral'} />
      </div>

      {/* Filter row */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            placeholder="Search SKU, product, brand…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <FlagPill label="All" value="all" current={flag} onSelect={setFlag} count={all.length} />
          <FlagPill
            label="Low"
            value="low"
            current={flag}
            onSelect={setFlag}
            count={stats.lowCount}
            tone="warning"
          />
          <FlagPill
            label="Out"
            value="out"
            current={flag}
            onSelect={setFlag}
            count={stats.outCount}
            tone="danger"
          />
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {inventory.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : inventory.isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load inventory."
          description={inventory.error instanceof ApiError ? inventory.error.message : 'Try again.'}
          action={<Button variant="outline" onClick={() => inventory.refetch()}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <Empty
          kicker={all.length === 0 ? 'No variants yet' : 'No matches'}
          title={
            all.length === 0
              ? 'Add a product with at least one variant to start tracking stock.'
              : 'Nothing matches your filters.'
          }
          description={
            all.length === 0 ? undefined : 'Try a different keyword or clear the filters.'
          }
          action={
            all.length === 0 ? (
              <Button variant="ink" caps asChild>
                <Link to="/retailer/listings">Go to products</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setQ('');
                  setStatus('all');
                  setFlag('all');
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <InventoryTable rows={filtered} />
      )}

        </TabsContent>

        <TabsContent value="health">
          <HealthTab rows={all} />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => inventory.refetch()}
      />
    </Page>
  );
}

// MOCK_DEPENDENCY: §21 — Inventory Health rollup (best/dead/oversold/low-stock)

function HealthTab({ rows }: { rows: InventoryRow[] }) {
  const lowStock = rows.filter((r) => r.stock > 0 && r.stock <= 5);
  const outOfStock = rows.filter((r) => r.stock === 0);
  const oversold = rows.filter((r) => r.reserved > r.stock);
  const bestStocked = [...rows].sort((a, b) => b.stock - a.stock).slice(0, 5);
  const deadStock = [...rows].filter((r) => r.stock > 20).slice(0, 5);

  return (
    <div className="space-y-6">
      <SectionHeading title="Inventory health" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HealthStat label="Low stock" count={lowStock.length} tone="warning" />
        <HealthStat label="Out of stock" count={outOfStock.length} tone="danger" />
        <HealthStat label="Oversold" count={oversold.length} tone="danger" />
        <HealthStat label="Dead stock (sample)" count={deadStock.length} tone="neutral" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HealthCard title="Top stocked variants" items={bestStocked.map((r) => ({ key: r.id, primary: r.listingName, secondary: `${r.attributesLabel} · ${r.stock} units` }))} />
        <HealthCard title="Possibly dead stock" items={deadStock.map((r) => ({ key: r.id, primary: r.listingName, secondary: `${r.attributesLabel} · ${r.stock} units · low velocity` }))} />
      </div>
    </div>
  );
}

function HealthStat({ label, count, tone }: { label: string; count: number; tone: 'neutral' | 'warning' | 'danger' }) {
  const toneCls = tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <div className="rounded-lg border border-line bg-bg p-4">
      <div className="kicker mb-1.5">{label}</div>
      <div className={`text-[26px] font-semibold leading-none ${toneCls}`}>{count}</div>
    </div>
  );
}

function HealthCard({ title, items }: { title: string; items: Array<{ key: string; primary: string; secondary: string }> }) {
  return (
    <div className="rounded-lg border border-line bg-bg">
      <div className="border-b border-line px-4 py-3 text-[13.5px] font-semibold text-ink">{title}</div>
      {items.length === 0 ? (
        <div className="p-4 text-[12.5px] text-ink-3 italic">Nothing to surface.</div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.key} className="px-4 py-2.5">
              <div className="text-[13px] text-ink">{it.primary}</div>
              <div className="text-[11.5px] text-ink-3">{it.secondary}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'inventory', 'adjustments'],
    queryFn: () => api<InventoryAdjustment[]>('/retailer/inventory/adjustments'),
  });
  const rows = data ?? [];

  return (
    <div className="space-y-3">
      <SectionHeading title="Adjustment history" />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Empty kicker="No history" title="No stock adjustments recorded yet." />
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
              <span
                className={cn(
                  'font-mono text-sm font-semibold shrink-0 w-14 text-right',
                  r.delta > 0 ? 'text-success' : 'text-danger',
                )}
              >
                {r.delta > 0 ? `+${r.delta}` : r.delta}
              </span>
              <div className="min-w-0 flex-1 text-[12.5px] text-ink">
                <span className="font-medium">{r.reason.replace(/_/g, ' ')}</span>
                {r.note && <span className="ml-1 text-ink-3"> — {r.note}</span>}
                <div className="text-ink-4 mt-0.5 font-mono">sku·{r.variantId.slice(-6)} → {r.newStock} in stock</div>
              </div>
              <span className="text-[11.5px] text-ink-4 shrink-0">{new Date(r.at).toLocaleDateString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stat tile
// ─────────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  return (
    <div className="surface-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="kicker text-ink-3">{label}</div>
        {tone === 'warning' && <span className="size-1.5 rounded-full bg-warning" aria-hidden />}
        {tone === 'danger' && <span className="size-1.5 rounded-full bg-danger pulse-dot" aria-hidden />}
      </div>
      <div
        className={cn(
          'mt-1 font-mono tabular text-[22px] leading-tight',
          tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-ink',
        )}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Flag pill (All / Low / Out)
// ─────────────────────────────────────────────────────────────────────

function FlagPill({
  label,
  value,
  current,
  onSelect,
  count,
  tone = 'neutral',
}: {
  label: string;
  value: FlagFilter;
  current: FlagFilter;
  onSelect: (v: FlagFilter) => void;
  count: number;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors press',
        active
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-line bg-bg text-ink-2 hover:border-line-2 hover:text-ink',
      )}
    >
      {tone === 'warning' && !active && <span className="size-1.5 rounded-full bg-warning" />}
      {tone === 'danger' && !active && <span className="size-1.5 rounded-full bg-danger" />}
      {label}
      {count > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 font-mono text-[10.5px]',
            active ? 'bg-accent-fg/20 text-accent-fg' : 'bg-bg-3 text-ink-2',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Table — row-tone via left rule, inline stock edit per row
// ─────────────────────────────────────────────────────────────────────

function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead className="bg-bg-2/70 sticky top-0 z-10 backdrop-blur">
            <tr className="border-b border-line">
              <Th className="w-[28%]">Product</Th>
              <Th className="w-[18%]">Variant</Th>
              <Th className="w-[12%]">SKU</Th>
              <Th className="w-[10%] text-right">Price</Th>
              <Th className="w-[10%] text-right">Stock</Th>
              <Th className="w-[8%] text-right">Reserved</Th>
              <Th className="w-[8%] text-right">Available</Th>
              <Th className="w-[6%] text-right">Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => <InventoryRowEl key={r.id} row={r} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryRowEl({ row }: { row: InventoryRow }) {
  const tone = stockToneOf(row);
  const meta = listingStatusMeta(row.listingStatus);
  const available = availableOf(row);

  return (
    <tr
      className={cn(
        'group hover:bg-bg-2/60 transition-colors',
        // Left rule: amber for low, red for out — silent neutral for ok rows.
        tone === 'low' && 'border-l-2 border-l-warning',
        tone === 'out' && 'border-l-2 border-l-danger',
      )}
    >
      <Td>
        <Link
          to={`/retailer/listings/${row.listingId}`}
          className="group/link block truncate"
        >
          <span className="font-medium text-ink group-hover/link:underline underline-offset-2">
            {row.listingName}
          </span>
          <span className="ml-1.5 text-ink-3 transition-opacity opacity-0 group-hover/link:opacity-100">
            <ArrowUpRight className="inline size-3" />
          </span>
          {row.brandName && (
            <span className="block truncate text-[11.5px] text-ink-3">{row.brandName}</span>
          )}
        </Link>
      </Td>
      <Td>
        <span className="text-ink-2">{row.attributesLabel}</span>
      </Td>
      <Td className="font-mono text-[12.5px] text-ink-2">
        {row.sku ?? <span className="text-ink-4">—</span>}
      </Td>
      <Td className="text-right font-mono tabular">
        {formatPaise(row.pricePaise)}
      </Td>
      <Td className="text-right">
        <StockEditor row={row} />
      </Td>
      <Td className="text-right font-mono tabular text-ink-3">
        {row.reserved}
      </Td>
      <Td className="text-right font-mono tabular">
        <span
          className={cn(
            tone === 'out' && 'text-danger font-semibold',
            tone === 'low' && 'text-warning font-semibold',
            tone === 'ok' && 'text-ink',
          )}
        >
          {available}
        </span>
      </Td>
      <Td className="text-right">
        <Badge tone={meta.tone} nodot>{meta.label}</Badge>
      </Td>
    </tr>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn('kicker text-ink-3 px-3 py-2.5 text-left', className)}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-3 align-middle', className)}>{children}</td>;
}

// ─────────────────────────────────────────────────────────────────────
// Inline stock editor — click-to-edit cell
// ─────────────────────────────────────────────────────────────────────

function StockEditor({ row }: { row: InventoryRow }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(row.stock));
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync the draft if the source value changes from elsewhere (e.g. CSV import).
  useEffect(() => {
    if (!editing) setDraft(String(row.stock));
  }, [row.stock, editing]);

  const save = useMutation({
    mutationFn: (next: number) =>
      api<Variant>(`/retailer/variants/${row.id}`, {
        method: 'PATCH',
        body: { stock: next },
      }),
    onSuccess: () => {
      setEditing(false);
      // Refresh both surfaces — the inventory list and any open listing detail.
      void qc.invalidateQueries({ queryKey: ['retailer', 'inventory'] });
      void qc.invalidateQueries({ queryKey: ['retailer', 'listing', row.listingId] });
      toast.success(`Stock saved · ${row.attributesLabel}`);
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'invalid_state'
          ? (e instanceof ApiError && e.message) || 'Cannot lower below reserved'
          : e instanceof Error
            ? e.message
            : 'Could not save stock',
      );
      // Snap the draft back so the operator can correct.
      setDraft(String(row.stock));
      inputRef.current?.focus();
    },
  });

  function commit() {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 0) {
      toast.error('Stock must be a non-negative integer');
      setDraft(String(row.stock));
      return;
    }
    if (n === row.stock) {
      setEditing(false);
      return;
    }
    save.mutate(n);
  }

  function cancel() {
    setDraft(String(row.stock));
    setEditing(false);
  }

  if (!editing) {
    const tone = stockToneOf(row);
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          // Focus on the next paint so the input is mounted.
          requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          });
        }}
        className={cn(
          'inline-flex min-w-[3.5rem] items-center justify-end rounded-md px-2 py-1 font-mono tabular',
          'hover:bg-bg-3 hover:ring-1 hover:ring-line-2 transition-colors press',
          tone === 'out' && 'text-danger font-semibold',
          tone === 'low' && 'text-warning font-semibold',
          tone === 'ok' && 'text-ink',
        )}
        aria-label={`Edit stock for ${row.attributesLabel}`}
      >
        {row.stock}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        disabled={save.isPending}
        className={cn(
          'h-8 w-20 rounded-md border border-line-2 bg-bg px-2 text-right font-mono tabular text-[13.5px] text-ink',
          'focus:border-ink focus:outline-none',
        )}
      />
      <button
        type="button"
        onClick={commit}
        disabled={save.isPending}
        className="grid size-7 place-items-center rounded-md bg-ink text-bg hover:bg-ink-2 press disabled:opacity-50"
        aria-label="Save stock"
      >
        <Check className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={save.isPending}
        className="grid size-7 place-items-center rounded-md border border-line text-ink-3 hover:bg-bg-3 press disabled:opacity-50"
        aria-label="Cancel edit"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CSV import dialog — parse client-side, preview, then submit JSON.
// ─────────────────────────────────────────────────────────────────────

type ImportStage =
  | { kind: 'idle' }
  | { kind: 'parsed'; rows: ParsedImportRow[]; parseErrors: ParseError[]; fileName: string }
  | { kind: 'done'; result: InventoryImportResult };

function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}) {
  const [stage, setStage] = useState<ImportStage>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset whenever the dialog closes — never carry stale rows into a fresh attempt.
  useEffect(() => {
    if (!open) setStage({ kind: 'idle' });
  }, [open]);

  const submit = useMutation({
    mutationFn: (rows: ParsedImportRow[]) =>
      api<InventoryImportResult>('/retailer/inventory/import', {
        method: 'POST',
        body: { rows },
      }),
    onSuccess: (result) => {
      setStage({ kind: 'done', result });
      if (result.applied > 0) {
        toast.success(`Imported · ${result.applied} variant${result.applied === 1 ? '' : 's'} updated`);
        onImported();
      }
      if (result.skipped > 0 && result.applied === 0) {
        toast.error('All rows skipped — check the error list');
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    },
  });

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseInventoryCsv(text);
      setStage({
        kind: 'parsed',
        rows: parsed.rows,
        parseErrors: parsed.errors,
        fileName: file.name,
      });
    };
    reader.onerror = () => toast.error("Couldn't read that file");
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import stock from CSV</DialogTitle>
          <DialogDescription>
            Header row must include <code className="font-mono text-ink-2">sku</code> and{' '}
            <code className="font-mono text-ink-2">stock</code> columns. Other columns are
            ignored. SKUs that don't match a variant are reported, never silently dropped.
          </DialogDescription>
        </DialogHeader>

        {stage.kind === 'idle' && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors',
              dragging
                ? 'border-ink bg-bg-2'
                : 'border-line bg-bg-2/40 hover:border-line-2',
            )}
          >
            <Upload className="size-7 text-ink-3" />
            <p className="mt-3 text-[13.5px] text-ink-2">
              Drop a CSV here, or pick a file.
            </p>
            <p className="mt-1 text-[11.5px] text-ink-3">
              Up to 5,000 rows. Empty lines are skipped.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file…
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                // Reset so picking the same file twice still re-fires onChange.
                e.target.value = '';
              }}
            />
          </div>
        )}

        {stage.kind === 'parsed' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-line bg-bg-2/60 px-3 py-2 text-[13px]">
              <div className="min-w-0 truncate">
                <span className="kicker mr-2">File</span>
                <span className="font-mono text-ink">{stage.fileName}</span>
              </div>
              <button
                type="button"
                onClick={() => setStage({ kind: 'idle' })}
                className="text-[12px] text-ink-3 hover:text-ink"
              >
                Replace
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[12.5px]">
              <div className="rounded-lg border border-line px-3 py-2">
                <div className="kicker">Ready to import</div>
                <div className="mt-1 font-mono tabular text-[20px] text-ink">
                  {stage.rows.length}
                </div>
              </div>
              <div className="rounded-lg border border-line px-3 py-2">
                <div className="kicker">Parse errors</div>
                <div
                  className={cn(
                    'mt-1 font-mono tabular text-[20px]',
                    stage.parseErrors.length > 0 ? 'text-warning' : 'text-ink',
                  )}
                >
                  {stage.parseErrors.length}
                </div>
              </div>
            </div>

            {stage.parseErrors.length > 0 && (
              <ParseErrorList errors={stage.parseErrors} />
            )}
          </div>
        )}

        {stage.kind === 'done' && <ImportSummary result={stage.result} />}

        <DialogFooter>
          {stage.kind === 'parsed' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="ink"
                caps
                disabled={stage.rows.length === 0}
                loading={submit.isPending}
                onClick={() => submit.mutate(stage.rows)}
              >
                Import {stage.rows.length} row{stage.rows.length === 1 ? '' : 's'}
              </Button>
            </>
          )}
          {stage.kind === 'done' && (
            <Button variant="ink" caps onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
          {stage.kind === 'idle' && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParseErrorList({ errors }: { errors: ParseError[] }) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2">
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-warning">
        <FileWarning className="size-3.5" />
        {errors.length} row{errors.length === 1 ? '' : 's'} can't be imported
      </div>
      <ul className="mt-2 max-h-32 overflow-y-auto space-y-0.5 text-[12px] text-ink-2">
        {errors.slice(0, 50).map((e, i) => (
          <li key={i} className="font-mono">
            <span className="text-ink-3">row {e.row}:</span> {e.message}
          </li>
        ))}
        {errors.length > 50 && (
          <li className="text-ink-3 italic">…and {errors.length - 50} more</li>
        )}
      </ul>
    </div>
  );
}

function ImportSummary({ result }: { result: InventoryImportResult }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-success/30 bg-success-soft px-3 py-2">
          <div className="kicker text-success">Applied</div>
          <div className="mt-1 font-mono tabular text-[24px] text-success-strong">
            {result.applied}
          </div>
        </div>
        <div
          className={cn(
            'rounded-lg border px-3 py-2',
            result.skipped > 0 ? 'border-warning/30 bg-warning-soft' : 'border-line',
          )}
        >
          <div className={cn('kicker', result.skipped > 0 && 'text-warning')}>Skipped</div>
          <div
            className={cn(
              'mt-1 font-mono tabular text-[24px]',
              result.skipped > 0 ? 'text-warning' : 'text-ink',
            )}
          >
            {result.skipped}
          </div>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-lg border border-line bg-bg-2/60 px-3 py-2">
          <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
            <AlertTriangle className="size-3.5 text-warning" />
            Per-row reasons
          </div>
          <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5 text-[12px]">
            {result.errors.map((e, i) => (
              <li key={i} className="font-mono">
                <span className="text-ink-3">row {e.row}</span>
                {' · '}
                <span className="text-ink-2">{e.sku}</span>
                {' · '}
                <span className="text-ink">{importReasonLabel(e.reason)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11.5px] text-ink-3">
        Threshold for "low" stays at {LOW_STOCK_THRESHOLD} units of available stock.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CSV export — hits the backend, lets the browser save the file.
// ─────────────────────────────────────────────────────────────────────

async function downloadInventoryCsv() {
  try {
    // We hit fetch directly so we get the raw response (the `api` helper unwraps
    // the JSON envelope, which doesn't apply to CSV).
    const token = getToken();
    const res = await fetch(`${BASE}/retailer/inventory/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      // Try to extract an error message from the JSON envelope; if it isn't JSON
      // (e.g. a proxy 502), fall back to the status code.
      let msg = `Export failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error?.message) msg = body.error.message;
      } catch {
        /* not JSON; keep generic */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    // Defer cleanup. Revoking the blob URL synchronously after .click() races
    // against the browser's download dispatch — some browsers cancel the download
    // before they've started reading the blob. 1s is well after dispatch in every
    // engine but still polite about memory.
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
    toast.success('Inventory exported');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Export failed');
  }
}
