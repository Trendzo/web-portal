import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUpRight, Check, Edit3, ImageOff, Plus, Save, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { MediaGallery } from '@/components/ui/media-gallery';
import { VariantImagePicker } from '@/components/ui/variant-image-picker';
import { listingStatusMeta, formatPaise, mechanismLabel, formatDiscount, promotionStatusMeta } from '@/lib/status';
import type { AttributeAxisType, AttributeTemplate, Listing, Promotion, Variant } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListingAuditList } from '@/components/retailer/listing-audit-list';
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

// Stock has its own home in the Inventory tab — this dialog handles the slow-
// changing facts of a variant (price, SKU, images). If stock ever needs to ride
// along again, add it back here AND remove the read-only chip in the variant row.
const InventoryPatchSchema = z.object({
  pricePaise: z.coerce.number().int().positive(),
  sku: z.string().trim().min(1).max(64).optional().or(z.literal('').transform(() => undefined)),
});
type InventoryPatchValues = z.infer<typeof InventoryPatchSchema>;

/** A single (option name → value) row in the variant builder, e.g. `{ name: 'Size', value: 'M' }`. */
type AxisState = {
  name: string;
  type: AttributeAxisType;
  allowedValues: string[];
  selectedValues: string[];
};

type RowFields = { price: string; stock: string; sku: string };

function cartesian(axesValues: string[][]): string[][] {
  return axesValues.reduce<string[][]>(
    (acc, values) => acc.flatMap((combo) => values.map((v) => [...combo, v])),
    [[]],
  );
}

export default function ListingDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const listing = useQuery({
    queryKey: ['retailer', 'listing', id],
    queryFn: async () => {
      const all = await api<Listing[]>('/retailer/listings');
      const found = all.find((l) => l.id === id);
      if (!found) throw new ApiError(404, 'not_found', 'Listing not found');
      return found;
    },
  });

  if (listing.isLoading) {
    return (
      <Page>
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="mt-4 h-72" />
      </Page>
    );
  }
  if (listing.isError || !listing.data) {
    return (
      <Page>
        <Empty
          kicker="Not found"
          title="Couldn't find this product."
          description={listing.error instanceof ApiError ? listing.error.message : 'Unknown error'}
          action={<Button asChild variant="outline"><Link to="/retailer/listings">Back to products</Link></Button>}
        />
      </Page>
    );
  }

  const l = listing.data;
  const meta = listingStatusMeta(l.status);

  return (
    <Page>
      <Link
        to="/retailer/listings"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All products
      </Link>

      <PageHeader
        kicker={`${l.brand?.name ?? 'Unbranded'} · ${l.category?.label ?? l.categoryId}`}
        title={<em>{l.name}</em>}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {l.badge !== 'none' && <Badge flat>{l.badge}</Badge>}
          </div>
        }
      />

      <PublishPanel
        listing={l}
        onChanged={() => qc.invalidateQueries({ queryKey: ['retailer'] })}
      />

      <Tabs defaultValue="variants">
        <TabsList className="overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="variants">Variants &amp; inventory</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="ai">AI generations</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="variants">
          <VariantsTab listing={l} onChanged={() => qc.invalidateQueries({ queryKey: ['retailer'] })} />
        </TabsContent>
        <TabsContent value="details">
          <DetailsTab listing={l} onChanged={() => qc.invalidateQueries({ queryKey: ['retailer'] })} />
        </TabsContent>
        <TabsContent value="promotions">
          <PromotionsTab listing={l} />
        </TabsContent>
        <TabsContent value="ai">
          <AiGenerationsTab listing={l} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogTab listing={l} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function PromotionsTab({ listing }: { listing: Listing }) {
  const { data: promos, isLoading } = useQuery({
    queryKey: ['retailer', 'promotions', { listingId: listing.id }],
    queryFn: () => api<Promotion[]>(`/retailer/promotions?listingId=${listing.id}`),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeading title="Promotions targeting this listing" hint="Offers, coupons, and vouchers whose scope includes this listing" />
        <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
          <Link to="/retailer/promotions/new">New promotion</Link>
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !promos?.length ? (
        <Empty
          kicker="None yet"
          title="No promotions target this listing."
          description="Create a promotion and add this listing to its scope."
          action={
            <Button asChild variant="ink" size="sm">
              <Link to="/retailer/promotions/new">New promotion</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {promos.map((p) => {
            const meta = promotionStatusMeta(p.effectiveStatus);
            return (
              <li key={p.id}>
                <Link
                  to={`/retailer/promotions/${p.id}`}
                  className="flex items-center gap-3 rounded-lg border border-line bg-bg px-4 py-3 hover:bg-bg-2 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[13.5px] text-ink truncate">{p.name}</span>
                      <Badge flat>{mechanismLabel(p.mechanism)}</Badge>
                    </div>
                    <div className="mt-0.5 text-[12px] text-ink-3 truncate">
                      {formatDiscount(p.discountType, p.config)} · {new Date(p.validFrom).toLocaleDateString('en-IN')} – {new Date(p.validUntil).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <ArrowUpRight className="size-3.5 text-ink-3 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// MOCK_DEPENDENCY: §7 — per-listing AI submissions slice

function AiGenerationsTab({ listing }: { listing: Listing }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeading title="AI photo generations for this listing" />
        <Button asChild variant="accent" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
          <Link to={`/retailer/ai-catalog/new?listingId=${listing.id}`}>Generate new</Link>
        </Button>
      </div>
      <Empty
        kicker="Mocked"
        title="No AI generations yet"
        description="Submit input photos and let the AI catalog tool produce shot variants — accepted outputs auto-attach to the gallery."
        action={
          <Button asChild variant="outline">
            <Link to="/retailer/ai-catalog">Open AI catalog</Link>
          </Button>
        }
      />
    </div>
  );
}

// MOCK_DEPENDENCY: §5 — per-listing audit log

function AuditLogTab({ listing }: { listing: Listing }) {
  return <ListingAuditList listingId={listing.id} />;
}

function VariantsTab({ listing, onChanged }: { listing: Listing; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Variant | null>(null);
  const variants = listing.variants ?? [];

  const { data: templates } = useQuery({
    queryKey: ['retailer', 'attribute-templates'],
    queryFn: () => api<AttributeTemplate[]>('/retailer/attribute-templates'),
  });
  const activeTemplate = templates?.find((t) => t.id === listing.templateId);

  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-3">
        <SectionHeading
          title="Variants"
          hint={`${variants.length} on file`}
        />
        {activeTemplate && (
          <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <span className="text-ink-4">Template:</span>
            <a
              href={`/retailer/attribute-templates/${activeTemplate.id}`}
              className="font-medium text-ink hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {activeTemplate.name}
            </a>
          </div>
        )}
      </div>
      <div className="-mt-4 mb-6 flex justify-end">
        <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
          New variant
        </Button>
      </div>

      {variants.length === 0 ? (
        <Empty
          kicker="No variants"
          title="No variants yet."
          description="Add a variant to start tracking inventory — size, colour, SKU, and stock."
          action={
            <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
              Add variant
            </Button>
          }
        />
      ) : (
        <div className="border-t border-b border-ink/80 overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-rule">
                <Th className="w-[5%]">№</Th>
                <Th className="w-[8%]">Image</Th>
                <Th className="w-[30%]">Variant</Th>
                <Th className="w-[18%]">SKU</Th>
                <Th className="w-[14%] text-right">Price</Th>
                <Th className="w-[10%] text-right">Stock</Th>
                <Th className="w-[8%] text-right">Held</Th>
                <Th className="w-[7%] text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {variants.map((v, i) => (
                <tr key={v.id} className="hover:bg-surface/40">
                  <Td className="font-mono text-[11px] text-ink-3 align-middle">
                    {String(i + 1).padStart(2, '0')}
                  </Td>
                  <Td className="align-middle">
                    <VariantThumb urls={v.imageUrls ?? []} />
                  </Td>
                  <Td>
                    <div className="font-medium text-ink">{v.attributesLabel}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      {Object.entries(v.attributes).length > 0
                        ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' · ')
                        : 'No options'}
                    </div>
                  </Td>
                  <Td className="font-mono text-[12.5px]">
                    {v.sku ?? <span className="text-ink-4">—</span>}
                  </Td>
                  <Td className="text-right font-mono text-[14px] tabular-nums">
                    {formatPaise(v.pricePaise)}
                  </Td>
                  <Td className="text-right">
                    {/* Stock is read-only here on purpose — Inventory owns it.
                        Click jumps to the Inventory row pre-filtered by SKU (or
                        product name when no SKU is set). */}
                    <Link
                      to={`/retailer/inventory?q=${encodeURIComponent(v.sku ?? listing.name)}`}
                      className="group/stock inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[13.5px] tabular-nums text-ink-2 hover:bg-bg-3 hover:text-ink"
                      title="Edit stock in Inventory"
                    >
                      {v.stock}
                      <ArrowUpRight className="size-3 text-ink-4 transition-transform group-hover/stock:-translate-y-px group-hover/stock:translate-x-px" />
                    </Link>
                  </Td>
                  <Td className="text-right font-mono text-[13px] text-ink-3 tabular-nums">{v.reserved}</Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<Edit3 className="size-3.5" />}
                      onClick={() => setEditing(v)}
                    >
                      Edit
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateVariantsDialog
        open={adding}
        onOpenChange={setAdding}
        listingId={listing.id}
        currentTemplateId={listing.templateId ?? null}
        gallery={listing.galleryUrls ?? []}
        onCreated={onChanged}
      />
      <EditInventoryDialog
        target={editing}
        gallery={listing.galleryUrls ?? []}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
    </>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        'kicker text-ink-3 px-3 py-3 text-left ' + (className ?? '')
      }
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={'px-3 py-4 align-top ' + (className ?? '')}>{children}</td>;
}

function VariantThumb({ urls }: { urls: string[] }) {
  const primary = urls[0];
  if (!primary) {
    return (
      <div className="grid size-12 place-items-center rounded-xs border border-rule bg-paper-2 text-ink-4">
        <ImageOff className="size-4" />
      </div>
    );
  }
  return (
    <div className="relative size-12 overflow-hidden rounded-xs border border-rule bg-paper-2">
      <img src={primary} alt="" className="size-full object-contain" loading="lazy" />
      {urls.length > 1 ? (
        <span className="absolute right-0.5 bottom-0.5 rounded-xs bg-ink/85 px-1 font-mono text-[10px] text-paper">
          +{urls.length - 1}
        </span>
      ) : null}
    </div>
  );
}

function CreateVariantsDialog({
  open,
  onOpenChange,
  listingId,
  currentTemplateId,
  gallery,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listingId: string;
  currentTemplateId: string | null;
  gallery: string[];
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(currentTemplateId);
  const [axes, setAxes] = useState<AxisState[]>([]);
  const [rowOverrides, setRowOverrides] = useState<Record<string, RowFields>>({});
  const [bulkPrice, setBulkPrice] = useState('999');
  const [bulkStock, setBulkStock] = useState('0');
  const [globalImages, setGlobalImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ['retailer', 'attribute-templates'],
    queryFn: () => api<AttributeTemplate[]>('/retailer/attribute-templates'),
    enabled: open,
  });

  // Reset on close
  useEffect(() => {
    if (open) return;
    setAxes([]);
    setRowOverrides({});
    setBulkPrice('999');
    setBulkStock('0');
    setGlobalImages([]);
    setError(null);
    setSelectedTemplateId(currentTemplateId);
  }, [open, currentTemplateId]);

  // Populate axes whenever template loads or selection changes
  useEffect(() => {
    if (!selectedTemplateId || !templates) return;
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (tpl) {
      setAxes(tpl.axes.map((a) => ({ name: a.name, type: a.type, allowedValues: a.allowedValues, selectedValues: [] })));
      setRowOverrides({});
    }
  }, [selectedTemplateId, templates]);

  function handleSelectTemplate(tplId: string | null) {
    setSelectedTemplateId(tplId);
    setRowOverrides({});
    if (!tplId) {
      setAxes([]);
      return;
    }
    const tpl = templates?.find((t) => t.id === tplId);
    if (tpl) {
      setAxes(tpl.axes.map((a) => ({ name: a.name, type: a.type, allowedValues: a.allowedValues, selectedValues: [] })));
    }
  }

  function toggleEnumValue(axisIdx: number, value: string) {
    setAxes((prev) =>
      prev.map((a, i) => {
        if (i !== axisIdx) return a;
        const has = a.selectedValues.includes(value);
        return { ...a, selectedValues: has ? a.selectedValues.filter((v) => v !== value) : [...a.selectedValues, value] };
      }),
    );
    setRowOverrides({});
  }

  function setFreeValues(axisIdx: number, values: string[]) {
    setAxes((prev) => prev.map((a, i) => (i === axisIdx ? { ...a, selectedValues: values } : a)));
    setRowOverrides({});
  }

  function addManualAxis() {
    setAxes((prev) => [...prev, { name: '', type: 'free_text', allowedValues: [], selectedValues: [] }]);
  }

  function updateAxisName(axisIdx: number, name: string) {
    setAxes((prev) => prev.map((a, i) => (i === axisIdx ? { ...a, name } : a)));
  }

  function removeAxis(axisIdx: number) {
    setAxes((prev) => prev.filter((_, i) => i !== axisIdx));
    setRowOverrides({});
  }

  const activeAxes = axes.filter((a) => a.selectedValues.length > 0);

  const rows = useMemo(() => {
    if (activeAxes.length === 0) {
      return [{ key: '__default__', attrs: {} as Record<string, string>, label: 'Default' }];
    }
    return cartesian(activeAxes.map((a) => a.selectedValues)).map((combo) => ({
      key: combo.join('||'),
      attrs: Object.fromEntries(activeAxes.map((a, i) => [a.name.toLowerCase(), combo[i]!])),
      label: combo.join(' / '),
    }));
  }, [activeAxes]);

  function getRowFields(key: string): RowFields {
    return rowOverrides[key] ?? { price: bulkPrice, stock: bulkStock, sku: '' };
  }

  function updateRow(key: string, patch: Partial<RowFields>) {
    setRowOverrides((prev) => ({ ...prev, [key]: { ...getRowFields(key), ...patch } }));
  }

  // ── Mutation ────────────────────────────────────────────
  const create = useMutation({
    mutationFn: async () => {
      if (selectedTemplateId !== currentTemplateId) {
        await api(`/retailer/listings/${listingId}`, { method: 'PATCH', body: { templateId: selectedTemplateId } });
      }
      const payloads = rows.map((r) => {
        const rf = getRowFields(r.key);
        return {
          attributes: r.attrs,
          attributesLabel: r.label,
          pricePaise: Math.round(parseFloat(rf.price) * 100),
          stock: parseInt(rf.stock, 10),
          imageUrls: globalImages,
          ...(rf.sku.trim() ? { sku: rf.sku.trim().toUpperCase() } : {}),
        };
      });
      if (payloads.length === 1) {
        return api<Variant>(`/retailer/listings/${listingId}/variants`, { method: 'POST', body: payloads[0] });
      }
      return api(`/retailer/listings/${listingId}/variants/bulk`, { method: 'POST', body: { variants: payloads } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['retailer', 'listing', listingId] });
      toast.success(rows.length === 1 ? 'Variant created' : `${rows.length} variants created`);
      onOpenChange(false);
      onCreated();
    },
    onError: (e) => {
      setError(
        e instanceof ApiError && e.code === 'sku_taken'
          ? 'One or more SKUs already exist on this product.'
          : e instanceof Error
            ? e.message
            : 'Could not create variants',
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (axes.some((a) => a.selectedValues.length > 0 && !a.name.trim())) {
      setError('Each axis needs a name.');
      return;
    }
    for (const r of rows) {
      const rf = getRowFields(r.key);
      const price = parseFloat(rf.price);
      const stock = parseInt(rf.stock, 10);
      if (!Number.isFinite(price) || price < 0.01) {
        setError(`Price for "${r.label}" must be at least ₹0.01.`);
        return;
      }
      if (!Number.isFinite(stock) || stock < 0) {
        setError(`Stock for "${r.label}" must be 0 or more.`);
        return;
      }
    }
    create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle>Add variants</DialogTitle>
          <DialogDescription>
            Select values per axis to generate combinations, then set price &amp; stock for each.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-4">

            {/* Template picker */}
            {(templates?.length ?? 0) > 0 && (
              <section className="rounded-lg border border-line bg-bg-2/30 p-4">
                <Label hint="populates axes below">From template</Label>
                <Select
                  value={selectedTemplateId ?? '__none__'}
                  onValueChange={(v) => handleSelectTemplate(v === '__none__' ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="No template — build manually" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No template — build manually</SelectItem>
                    {templates!.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{t.isPlatformDefault ? ' · platform default' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
            )}

            {/* Axis value editors */}
            {axes.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="kicker text-ink-3">Select values per axis</span>
                  <span className="text-[11px] uppercase tracking-widest text-ink-3">{activeAxes.length} active</span>
                </div>
                {axes.map((axis, i) => (
                  <AxisValueEditor
                    key={i}
                    axis={axis}
                    fromTemplate={Boolean(selectedTemplateId)}
                    onNameChange={(name) => updateAxisName(i, name)}
                    onToggleEnum={(v) => toggleEnumValue(i, v)}
                    onSetFree={(values) => setFreeValues(i, values)}
                    onRemove={() => removeAxis(i)}
                  />
                ))}
              </section>
            )}

            {!selectedTemplateId && (
              <button
                type="button"
                onClick={addManualAxis}
                className="text-[12px] uppercase tracking-[0.14em] text-ink-2 hover:text-ink"
              >
                + Add axis
              </button>
            )}

            {/* Combination matrix */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <span className="kicker text-ink-3">
                  {rows.length} variant{rows.length !== 1 ? 's' : ''} will be created
                </span>
                {rows.length > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-ink-3">Apply to all —</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-ink-3">price ₹</span>
                      <Input
                        mono
                        type="number"
                        min={1}
                        value={bulkPrice}
                        onChange={(e) => { setBulkPrice(e.target.value); setRowOverrides({}); }}
                        className="h-7 w-24 text-[12px]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-ink-3">stock</span>
                      <Input
                        mono
                        type="number"
                        min={0}
                        value={bulkStock}
                        onChange={(e) => { setBulkStock(e.target.value); setRowOverrides({}); }}
                        className="h-7 w-20 text-[12px]"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-[12.5px]">
                  <thead className="border-b border-line bg-bg-2/40">
                    <tr>
                      <Th>Variant</Th>
                      <Th>SKU <span className="font-normal normal-case tracking-normal text-ink-4">(optional)</span></Th>
                      <Th>Price (₹)</Th>
                      <Th>Stock</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const rf = getRowFields(row.key);
                      return (
                        <tr key={row.key} className="border-b border-line last:border-0">
                          <Td className="font-medium text-ink">{row.label}</Td>
                          <Td>
                            <Input
                              mono
                              placeholder="LIN-M-BLK"
                              value={rf.sku}
                              onChange={(e) => updateRow(row.key, { sku: e.target.value.toUpperCase() })}
                              className="h-7 text-[12px] uppercase"
                            />
                          </Td>
                          <Td>
                            <Input
                              mono
                              type="number"
                              min={1}
                              value={rf.price}
                              onChange={(e) => updateRow(row.key, { price: e.target.value })}
                              className="h-7 w-28 text-[12px]"
                            />
                          </Td>
                          <Td>
                            <Input
                              mono
                              type="number"
                              min={0}
                              value={rf.stock}
                              onChange={(e) => updateRow(row.key, { stock: e.target.value })}
                              className="h-7 w-20 text-[12px]"
                            />
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Images — applied to all variants created in this batch */}
            {gallery.length > 0 && (
              <section>
                <div className="kicker mb-2 text-ink-3">
                  Images <span className="font-normal normal-case tracking-normal text-ink-4">— applied to all variants</span>
                </div>
                <VariantImagePicker gallery={gallery} selected={globalImages} onChange={setGlobalImages} />
              </section>
            )}

            {error && <FieldError>{error}</FieldError>}
          </div>

          <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={create.isPending}>
              Create {rows.length > 1 ? `${rows.length} variants` : 'variant'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AxisValueEditor({
  axis,
  fromTemplate,
  onNameChange,
  onToggleEnum,
  onSetFree,
  onRemove,
}: {
  axis: AxisState;
  fromTemplate: boolean;
  onNameChange: (name: string) => void;
  onToggleEnum: (value: string) => void;
  onSetFree: (values: string[]) => void;
  onRemove: () => void;
}) {
  const [freeInput, setFreeInput] = useState('');

  function addFreeValue() {
    const val = freeInput.trim();
    if (val && !axis.selectedValues.includes(val)) {
      onSetFree([...axis.selectedValues, val]);
    }
    setFreeInput('');
  }

  function handleFreeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFreeValue();
    } else if (e.key === 'Backspace' && !freeInput && axis.selectedValues.length > 0) {
      onSetFree(axis.selectedValues.slice(0, -1));
    }
  }

  return (
    <div className="rounded-lg border border-line bg-bg-2/20 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {fromTemplate ? (
            <div className="text-[13px] font-medium text-ink">{axis.name}</div>
          ) : (
            <Input
              placeholder="Axis name (e.g. Size)"
              value={axis.name}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-7 text-[12px]"
            />
          )}
          <span className="text-[11px] capitalize text-ink-4">{axis.type.replace('_', ' ')}</span>
        </div>
        {!fromTemplate && (
          <button type="button" onClick={onRemove} className="mt-0.5 text-ink-3 hover:text-danger">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {axis.type === 'enum' && axis.allowedValues.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {axis.allowedValues.map((v) => {
            const selected = axis.selectedValues.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => onToggleEnum(v)}
                className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                  selected
                    ? 'border-ink bg-ink text-paper'
                    : 'border-line bg-bg text-ink-2 hover:border-ink-3'
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[36px] flex-wrap items-center gap-1.5 rounded-md border border-line bg-bg px-2 py-1.5">
          {axis.selectedValues.map((v, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-sm bg-ink/8 px-2 py-0.5 text-[12px] text-ink-2">
              {v}
              <button
                type="button"
                onClick={() => onSetFree(axis.selectedValues.filter((_, j) => j !== i))}
                className="ml-0.5 text-ink-4 hover:text-danger"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
          <input
            value={freeInput}
            onChange={(e) => setFreeInput(e.target.value)}
            onKeyDown={handleFreeKeyDown}
            placeholder={axis.selectedValues.length === 0 ? 'Type a value and press Enter' : '+ add'}
            className="min-w-16 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-4"
          />
        </div>
      )}
    </div>
  );
}

function EditInventoryDialog({
  target,
  gallery,
  onClose,
  onSaved,
}: {
  target: Variant | null;
  gallery: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(InventoryPatchSchema),
    defaultValues: { pricePaise: 0, sku: '' },
    ...(target
      ? { values: { pricePaise: target.pricePaise, sku: target.sku ?? '' } }
      : {}),
  });

  // RHF's register hands us its own onChange — wrap it so the SKU uppercases as the
  // user types. Saved values match the displayed value, so the API and the cell render
  // both see "lin-01" → "LIN-01".
  const skuField = register('sku');

  // Image gallery is managed independently of the form fields — every change PATCHes
  // the variant immediately so the user can add/remove without hitting Save.
  const [imageUrls, setImageUrls] = useState<string[]>(target?.imageUrls ?? []);
  useEffect(() => {
    setImageUrls(target?.imageUrls ?? []);
  }, [target]);

  const save = useMutation({
    mutationFn: (v: InventoryPatchValues) =>
      api<Variant>(`/retailer/variants/${target!.id}`, {
        method: 'PATCH',
        body: {
          pricePaise: v.pricePaise,
          ...(v.sku ? { sku: v.sku } : {}),
          imageUrls,
        },
      }),
    onSuccess: () => {
      toast.success('Variant updated');
      onClose();
      reset();
      onSaved();
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'sku_taken'
          ? 'That SKU collides with another variant.'
          : e instanceof Error
            ? e.message
            : 'Could not save',
      );
    },
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {target?.attributesLabel}</DialogTitle>
          <DialogDescription>
            Update price, SKU, or images. Stock lives on the{' '}
            <Link to="/retailer/inventory" className="text-ink underline underline-offset-2">
              Inventory
            </Link>{' '}
            tab.
          </DialogDescription>
        </DialogHeader>
        {target && (
          <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-6" noValidate>
            <div>
              <div className="kicker mb-2 text-ink-3">Pricing &amp; identity</div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ePrice" required hint="paise">Price</Label>
                  <Input id="ePrice" mono type="number" min={1} {...register('pricePaise')} />
                  <FieldError>{errors.pricePaise?.message}</FieldError>
                </div>
                <div>
                  <Label htmlFor="eSku">SKU</Label>
                  <Input
                    id="eSku"
                    mono
                    className="uppercase"
                    {...skuField}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      setValue('sku', e.target.value, { shouldDirty: true, shouldValidate: true });
                    }}
                  />
                  <FieldError>{errors.sku?.message}</FieldError>
                </div>
              </div>
              <p className="mt-2 text-[11.5px] uppercase tracking-[0.14em] text-ink-3">
                Stock <span className="text-ink font-mono normal-case">{target.stock}</span>{' '}
                · reserved <span className="text-ink font-mono normal-case">{target.reserved}</span>{' '}
                · edit on the Inventory tab.
              </p>
            </div>

            <div>
              <div className="kicker mb-2 text-ink-3">Images</div>
              <VariantImagePicker
                gallery={gallery}
                selected={imageUrls}
                onChange={setImageUrls}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="ink" caps loading={isSubmitting || save.isPending} iconLeft={<Save className="size-3.5" />}>
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

const DetailsPatchSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().or(z.literal('').transform(() => undefined)),
  badge: z.enum(['new', 'hot', 'trending', 'none']),
  listingPolicy: z.enum(['return', 'replace', 'final_sale']),
  status: z.enum(['draft', 'active', 'retired']),
});
type DetailsPatchValues = z.infer<typeof DetailsPatchSchema>;

function DetailsTab({ listing, onChanged }: { listing: Listing; onChanged: () => void }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(DetailsPatchSchema),
    defaultValues: {
      name: listing.name,
      description: listing.description ?? '',
      badge: listing.badge,
      listingPolicy: listing.listingPolicy,
      status: listing.status,
    },
  });

  const save = useMutation({
    mutationFn: (v: DetailsPatchValues) =>
      api<Listing>(`/retailer/listings/${listing.id}`, { method: 'PATCH', body: v }),
    onSuccess: () => {
      toast.success('Saved');
      onChanged();
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'store_not_active'
          ? 'Store needs to be active to publish.'
          : e instanceof Error
            ? e.message
            : 'Save failed',
      );
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate(v))}
      className="grid gap-12 lg:grid-cols-12"
    >
      <section className="lg:col-span-7 space-y-7">
        <SectionHeading title="Product info" />
        <div>
          <Label htmlFor="dName" required>Name</Label>
          <Input id="dName" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="dDesc" hint="Optional">Description</Label>
          <Textarea id="dDesc" rows={6} {...register('description')} />
          <FieldError>{errors.description?.message}</FieldError>
        </div>
      </section>

      <section className="lg:col-span-5 space-y-7">
        <SectionHeading title="Metadata" />
        <div>
          <Label hint="Publish via the panel above">Status</Label>
          <Select
            value={watch('status') === 'active' ? 'active' : watch('status')}
            onValueChange={(v) => setValue('status', v as DetailsPatchValues['status'])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              {watch('status') === 'active' && <SelectItem value="active">Active</SelectItem>}
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Badge</Label>
          <Select value={watch('badge')} onValueChange={(v) => setValue('badge', v as DetailsPatchValues['badge'])}>
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
          <Label>Return policy</Label>
          <Select
            value={watch('listingPolicy')}
            onValueChange={(v) => setValue('listingPolicy', v as DetailsPatchValues['listingPolicy'])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="return">Returnable</SelectItem>
              <SelectItem value="replace">Replace only</SelectItem>
              <SelectItem value="final_sale">Final sale</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <div className="lg:col-span-12 flex items-center justify-end gap-2 border-t border-rule pt-6">
        <Button
          type="submit"
          variant="ink"
          caps
          loading={isSubmitting || save.isPending}
          iconLeft={<Save className="size-3.5" />}
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}

/**
 * Publish-readiness panel — shown above the tabs on the listing detail page.
 *  - Mirrors the backend gate exactly: at least one variant + at least one gallery image
 *  - Owns the Publish action (so it can run readiness checks BEFORE the API hop)
 *  - Owns gallery-URL management (paste any image URL, no upload pipeline yet)
 *  - Once published, switches to a compact "Published" header with an Unpublish action
 */
function PublishPanel({ listing, onChanged }: { listing: Listing; onChanged: () => void }) {
  const variants = listing.variants ?? [];
  const images = listing.galleryUrls ?? [];
  const hasVariants = variants.length > 0;
  const hasImages = images.length > 0;
  const ready = hasVariants && hasImages;
  const isPublished = listing.status === 'active';

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Listing>(`/retailer/listings/${listing.id}`, { method: 'PATCH', body }),
    onSuccess: () => onChanged(),
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      const msg =
        code === 'cannot_publish_incomplete'
          ? e instanceof ApiError ? e.message : 'Cannot publish — listing is incomplete.'
          : code === 'store_not_active'
            ? 'Your store is not active.'
            : code === 'retailer_not_approved'
              ? 'Your account needs admin approval first.'
              : e instanceof Error
                ? e.message
                : 'Update failed.';
      toast.error(msg);
    },
  });

  function publish() {
    patch.mutate({ status: 'active' });
  }

  function unpublish() {
    patch.mutate({ status: 'draft' });
  }

  return (
    <section className="mb-8 border border-rule bg-surface p-5 sm:p-6 rounded-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="kicker text-ink-3">Publish status</div>
          <h2 className="font-display italic text-[22px] sm:text-[24px] leading-tight mt-1">
            {isPublished ? <>This product is <em>live</em>.</> : <>Get this product ready to publish.</>}
          </h2>
        </div>
        {isPublished ? (
          <Button
            variant="outline"
            size="sm"
            onClick={unpublish}
            loading={patch.isPending && (patch.variables as { status?: string } | undefined)?.status === 'draft'}
          >
            Unpublish (back to draft)
          </Button>
        ) : (
          <Button
            variant="ink"
            caps
            size="sm"
            disabled={!ready}
            loading={patch.isPending && (patch.variables as { status?: string } | undefined)?.status === 'active'}
            iconLeft={<Check className="size-3.5" />}
            onClick={publish}
            title={!ready ? 'Add at least one variant and one image to publish' : undefined}
          >
            Publish
          </Button>
        )}
      </div>

      {/* Readiness checklist — only shown while drafting */}
      {!isPublished && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ReadyItem
            ok={hasVariants}
            label="At least one variant"
            detail={
              hasVariants
                ? `${variants.length} on file (price + stock set)`
                : 'Add a variant in the tab below — it carries SKU, price, and stock.'
            }
          />
          <ReadyItem
            ok={hasImages}
            label="At least one image"
            detail={
              hasImages
                ? `${images.length} on file · drag in the gallery below to reorder`
                : 'Drop a file in the gallery below — crop, then we host it on the CDN.'
            }
          />
        </div>
      )}

      {/* Full media gallery — drag/drop, crop, sortable preview, URL fallback */}
      <div className="mt-6 border-t border-rule pt-5">
        <MediaGallery
          urls={images}
          uploadFolder={`products/${listing.id}`}
          busy={patch.isPending}
          onChange={(next) => patch.mutate({ galleryUrls: next })}
        />
      </div>
    </section>
  );
}

function ReadyItem({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 border border-rule rounded-xs px-3 py-2.5">
      <span
        className={
          ok
            ? 'mt-0.5 grid size-5 place-items-center rounded-full bg-success-soft text-success'
            : 'mt-0.5 grid size-5 place-items-center rounded-full bg-warning-soft text-warning'
        }
        aria-hidden
      >
        {ok ? <Check className="size-3" /> : <span className="size-1.5 bg-warning rounded-full" />}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-[12px] text-ink-3">{detail}</div>
      </div>
    </div>
  );
}

