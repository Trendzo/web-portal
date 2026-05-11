import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Download, Sparkles } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Promotion } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function RetailerVoucherBatch() {
  const [promoId, setPromoId] = useState('');
  const [count, setCount] = useState('100');
  const [prefix, setPrefix] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState('');

  const promos = useQuery({
    queryKey: ['retailer', 'promotions', 'voucher'],
    queryFn: () => api<Promotion[]>('/retailer/promotions?mechanism=voucher&pageSize=100'),
  });

  const vouchers = (promos.data ?? []).filter((p) => p.mechanism === 'voucher');

  const generate = useMutation({
    mutationFn: () => {
      setError('');
      const n = Number(count);
      if (!Number.isInteger(n) || n < 1 || n > 10_000) {
        setError('Count must be between 1 and 10,000');
        return Promise.reject(new Error('invalid count'));
      }
      if (!promoId) {
        setError('Select a promotion');
        return Promise.reject(new Error('no promo'));
      }
      return api<{ codes: string[] }>('/retailer/voucher-codes/generate', {
        method: 'POST',
        body: {
          promotionId: promoId,
          count: n,
          ...(prefix.trim() ? { prefix: prefix.trim().toUpperCase() } : {}),
        },
      });
    },
    onSuccess: (data) => {
      setCodes(data.codes);
      toast.success(`${data.codes.length} codes generated`);
    },
    onError: (e) => {
      if (e instanceof ApiError) setError(e.message);
    },
  });

  function downloadCsv() {
    const token = localStorage.getItem('closetx-dashboard.auth');
    const authToken = token ? JSON.parse(token).state?.session?.token ?? '' : '';
    const url = `/api/v1/retailer/voucher-codes/export?promotionId=${promoId}`;
    fetch(url, { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `vouchers-${promoId}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Could not download CSV'));
  }

  function copyAll() {
    void navigator.clipboard.writeText(codes.join('\n'));
    toast.success(`Copied ${codes.length} codes`);
  }

  return (
    <Page>
      <PageHeader
        kicker="Vouchers"
        title="Bulk voucher batch"
        description="Generate single-use voucher codes for a promotion. Each code redeems once globally. Download CSV for distribution."
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/retailer/promotions">Back to promotions</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardContent className="p-6 space-y-4">
            <SectionHeading kicker="Setup" title="Batch parameters" />
            <div>
              <Label required>Promotion</Label>
              {promos.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : vouchers.length === 0 ? (
                <p className="text-[12.5px] text-ink-3 italic mt-1">
                  No voucher promotions yet.{' '}
                  <Link to="/retailer/promotions/new" className="underline text-ink-2">Create one</Link> with mechanism set to &quot;Voucher&quot;.
                </p>
              ) : (
                <Select value={promoId} onValueChange={setPromoId}>
                  <SelectTrigger><SelectValue placeholder="Select a promotion…" /></SelectTrigger>
                  <SelectContent>
                    {vouchers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label required hint="1 to 10,000">Count</Label>
              <Input
                type="number"
                min="1"
                max="10000"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
            <div>
              <Label hint="Optional — prepended to each code, A–Z and 0–9 only">Prefix</Label>
              <Input
                mono
                placeholder="e.g. DROP24"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              />
            </div>
            {error && <FieldError>{error}</FieldError>}
            <Button
              variant="accent"
              iconLeft={<Sparkles className="size-3.5" />}
              loading={generate.isPending}
              onClick={() => generate.mutate()}
            >
              Generate codes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <SectionHeading kicker="Output" title={`${codes.length} code${codes.length === 1 ? '' : 's'}`} />
              {codes.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" iconLeft={<Copy className="size-3.5" />} onClick={copyAll}>
                    Copy all
                  </Button>
                  <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={downloadCsv} disabled={!promoId}>
                    Download CSV
                  </Button>
                </div>
              )}
            </div>
            {codes.length === 0 ? (
              <Empty kicker="Empty" title="No codes yet." description="Fill in the form and click Generate." />
            ) : (
              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 max-h-[480px] overflow-y-auto pr-1">
                {codes.slice(0, 300).map((c) => (
                  <li key={c} className="rounded border border-line bg-bg-2/30 px-2 py-1 font-mono text-[11.5px] text-ink">
                    {c}
                  </li>
                ))}
                {codes.length > 300 && (
                  <li className="col-span-full mt-1 text-[11.5px] text-ink-3 italic">
                    Showing first 300 — full set in CSV download.
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
