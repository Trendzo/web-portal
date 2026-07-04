import { useEffect, useState } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { usePermission } from '@/lib/use-permission';
import { barcodeSvg } from '@/lib/pos-barcode';
import { qrSvg } from '@/lib/pos-qr';
import type { PosLookupResult, PosLookupRow } from '@/lib/pos-types';
import { Page, PageHeader } from '@/components/ui/page';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Segmented } from '@/components/ui/segmented';

type LabelSize = 'sm' | 'md' | 'lg';
const SIZES: Record<LabelSize, { label: string; w: number; h: number }> = {
  sm: { label: '38×25mm', w: 38, h: 25 },
  md: { label: '50×25mm', w: 50, h: 25 },
  lg: { label: '65×38mm', w: 65, h: 38 },
};

// What the printed tag shows. Persisted so the counter keeps its house style.
type CodeType = 'qr' | 'barcode';
type LabelConfig = {
  codeType: CodeType;
  showName: boolean;
  showVariant: boolean;
  showPrice: boolean;
  showCompareAt: boolean;
  showCode: boolean;
};
const DEFAULT_CONFIG: LabelConfig = {
  codeType: 'qr',
  showName: true,
  showVariant: true,
  showPrice: true,
  showCompareAt: true,
  showCode: false,
};
const CONFIG_KEY = 'pos.labelConfig';

function loadConfig(): LabelConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<LabelConfig>) };
  } catch {
    /* ignore malformed persisted config */
  }
  return DEFAULT_CONFIG;
}

const FIELD_TOGGLES: { key: keyof LabelConfig; label: string }[] = [
  { key: 'showName', label: 'Product name' },
  { key: 'showVariant', label: 'Size / variant' },
  { key: 'showPrice', label: 'Price' },
  { key: 'showCompareAt', label: 'Compare-at price' },
  { key: 'showCode', label: 'Code text' },
];

type Pick = PosLookupRow & { count: number };

export default function PosLabels() {
  const canLabels = usePermission('pos.labels');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PosLookupRow[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [size, setSize] = useState<LabelSize>('md');
  const [config, setConfig] = useState<LabelConfig>(loadConfig);

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      /* storage may be unavailable — non-fatal */
    }
  }, [config]);

  async function search() {
    if (q.trim().length < 2) return;
    const res = await api<PosLookupResult>(`/retailer/pos/lookup?q=${encodeURIComponent(q.trim())}`);
    setResults(res.exact ? [res.exact] : res.results);
  }

  function add(r: PosLookupRow) {
    setPicks((p) =>
      p.find((x) => x.variantId === r.variantId)
        ? p.map((x) => (x.variantId === r.variantId ? { ...x, count: x.count + 1 } : x))
        : [...p, { ...r, count: 1 }],
    );
  }

  function print() {
    const dim = SIZES[size];
    const cells = picks
      .flatMap((p) => {
        // Barcode is for generic Code128 readers, so it must carry the scannable barcode/SKU.
        // The QR is app-specific: encode the stable variantId so the retailer app resolves it
        // directly (never depends on a barcode/SKU being set).
        const humanCode = p.barcode || p.sku;
        if (config.codeType === 'barcode' && !humanCode) {
          toast.error(`"${p.name}" has no barcode or SKU — skipped`);
          return [];
        }
        const codeSvg =
          config.codeType === 'qr'
            ? qrSvg(`cx:v:${p.variantId}`)
            : barcodeSvg(humanCode!, { height: dim.h > 30 ? 42 : 30, moduleWidth: 1.3 });
        const hasCompare =
          config.showCompareAt && p.compareAtPaise != null && p.compareAtPaise > p.pricePaise;
        const priceRow = config.showPrice
          ? `<div class="row">${hasCompare ? `<span class="cmp">${formatPaise(p.compareAtPaise!)}</span>` : ''}<span class="price">${formatPaise(p.pricePaise)}</span></div>`
          : '';
        return Array.from({ length: p.count }, () => `
          <div class="label ${config.codeType}">
            ${config.showName ? `<div class="name">${escapeHtml(p.name)}</div>` : ''}
            ${config.showVariant ? `<div class="attr">${escapeHtml(p.attributesLabel)}</div>` : ''}
            <div class="code">${codeSvg}</div>
            ${config.showCode && humanCode ? `<div class="ctext">${escapeHtml(humanCode)}</div>` : ''}
            ${priceRow}
          </div>`);
      })
      .join('');
    if (!cells) {
      toast.error('Nothing to print');
      return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title>
    <style>
      @page { margin: 5mm; }
      * { font-family: Arial, sans-serif; box-sizing: border-box; }
      body { margin: 0; display: flex; flex-wrap: wrap; gap: 2mm; }
      .label { width: ${dim.w}mm; height: ${dim.h}mm; border: 1px solid #eee; padding: 1mm 1.5mm; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
      .name { font-size: 8px; font-weight: 700; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .attr { font-size: 7px; color: #555; }
      .code { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
      .label.barcode .code svg { width: 100%; height: auto; }
      .label.qr .code svg { height: 100%; width: auto; max-width: 100%; }
      .ctext { font-size: 6.5px; color: #444; text-align: center; }
      .row { display: flex; justify-content: flex-end; align-items: baseline; gap: 3px; }
      .cmp { font-size: 7px; color: #888; text-decoration: line-through; }
      .price { font-size: 10px; font-weight: 700; }
    </style></head><body>${cells}</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1000);
    }, 200);
  }

  if (!canLabels) return <Page><Empty title="Not authorized" description="You don't have access to label printing." /></Page>;

  return (
    <Page>
      <PageHeader title="Product labels" description="Print scannable QR or barcode price tags for your products" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <div className="flex gap-2">
              <Input
                placeholder="Search products by name / SKU…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
              />
              <Button variant="outline" onClick={search}>Search</Button>
            </div>
            <div className="mt-2 space-y-1">
              {results.map((r) => (
                <button
                  key={r.variantId}
                  onClick={() => add(r)}
                  className="flex w-full items-center justify-between rounded-lg border border-line bg-bg px-3 py-2 text-left text-[13px] hover:bg-bg-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{r.name}</span>
                    <span className="text-[11px] text-ink-4">{r.attributesLabel}{r.sku ? ` · ${r.sku}` : ''}</span>
                  </span>
                  <span className="font-medium">{formatPaise(r.pricePaise)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Label configuration */}
          <div className="rounded-xl border border-line bg-bg p-4">
            <div className="mb-3 text-[13px] font-medium text-ink">Label configuration</div>
            <div className="mb-3">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-4">Code type</div>
              <Segmented
                options={[
                  { value: 'qr', label: 'QR code' },
                  { value: 'barcode', label: 'Barcode' },
                ]}
                value={config.codeType}
                onChange={(v) => setConfig((c) => ({ ...c, codeType: v }))}
              />
            </div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-4">Show on label</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {FIELD_TOGGLES.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-[12px] text-ink-3">
                  <input
                    type="checkbox"
                    checked={config[f.key] as boolean}
                    onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.checked }))}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-bg p-4">
          <div className="mb-3 flex items-center justify-between">
            <Segmented
              options={(Object.keys(SIZES) as LabelSize[]).map((k) => ({ value: k, label: SIZES[k].label }))}
              value={size}
              onChange={setSize}
            />
            <Button variant="accent" size="sm" iconLeft={<Printer className="size-4" />} disabled={picks.length === 0} onClick={print}>
              Print sheet
            </Button>
          </div>
          {picks.length === 0 ? (
            <Empty title="No labels selected" description="Search and add products to build a label sheet." />
          ) : (
            <div className="space-y-1.5">
              {picks.map((p) => (
                <div key={p.variantId} className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">{p.name} · {p.attributesLabel}</span>
                  <Input
                    type="number"
                    min={1}
                    value={p.count}
                    onChange={(e) =>
                      setPicks((prev) =>
                        prev.map((x) => (x.variantId === p.variantId ? { ...x, count: Math.max(1, Number(e.target.value)) } : x)),
                      )
                    }
                    className="w-16"
                  />
                  <Button variant="ghost" size="icon-sm" onClick={() => setPicks((prev) => prev.filter((x) => x.variantId !== p.variantId))}>
                    <Trash2 className="size-3.5 text-ink-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}
