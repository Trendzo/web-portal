import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useStoreRetailerId } from '@/hooks/useStoreRetailerId';
import { toast } from 'sonner';
import { ArrowLeft, Download } from 'lucide-react';
import { api, ApiError, BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';

export default function AdminStoreVoucherBatch() {
  const { storeId, promoId } = useParams<{ storeId: string; promoId: string }>();
  const retailerId = useStoreRetailerId(storeId);
  const [count, setCount] = useState('100');
  const [prefix, setPrefix] = useState('');
  const [sample, setSample] = useState<string[]>([]);

  const generate = useMutation({
    mutationFn: () =>
      api<{ generated: number; sample: string[] }>(
        `/admin/stores/${storeId}/promotions/${promoId}/voucher-codes/generate`,
        { method: 'POST', body: { count: parseInt(count, 10) || 0, prefix: prefix.trim() || undefined } },
      ),
    onSuccess: (r) => {
      toast.success(`Generated ${r.generated} codes`);
      setSample(r.sample);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Generate failed'),
  });

  async function exportCsv() {
    const token = getToken();
    const res = await fetch(
      `${BASE}/admin/stores/${storeId}/promotions/${promoId}/voucher-codes/export`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) {
      toast.error('Export failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vouchers-${promoId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const parsed = parseInt(count, 10);
  const valid = !Number.isNaN(parsed) && parsed >= 1 && parsed <= 10_000;

  return (
    <Page>
      <PageHeader
        kicker="Promotion"
        title="Voucher batch"
        description="Generate up to 10 000 codes for this promotion. Download as CSV when ready."
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to={`/admin/retailers/${retailerId}/stores/${storeId}/promotions`}>Back</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="count" required>Number of codes</Label>
              <Input id="count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
              <FieldError>{count && !valid ? 'Enter 1 – 10000' : ''}</FieldError>
            </div>
            <div>
              <Label htmlFor="prefix">Prefix (optional)</Label>
              <Input id="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="DIWALI" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ink" disabled={!valid} loading={generate.isPending} onClick={() => generate.mutate()}>
              Generate {valid ? count : ''} codes
            </Button>
            <Button variant="outline" iconLeft={<Download className="size-3.5" />} onClick={() => void exportCsv()}>
              Download CSV
            </Button>
          </div>
          {sample.length > 0 && (
            <div className="rounded border border-line bg-bg-2 p-3">
              <div className="text-[12px] text-ink-3">Sample (first 5):</div>
              <ul className="mt-1 font-mono text-[12px] text-ink">
                {sample.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
