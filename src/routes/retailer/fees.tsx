import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { RetailerFeeView } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetaList } from '@/components/ui/meta-list';

export default function RetailerFees() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'fees'],
    queryFn: () => api<RetailerFeeView>('/retailer/fees'),
  });
  const [handling, setHandling] = useState<string>('0');
  const [convenience, setConvenience] = useState<string>('0');
  useEffect(() => {
    if (data) {
      setHandling((data.handlingFeePaise / 100).toString());
      setConvenience((data.convenienceFeePaise / 100).toString());
    }
  }, [data]);

  if (isLoading || !data) {
    return <Page><PageHeader title="Fees affecting your store" /><Skeleton className="h-72" /></Page>;
  }

  const delegationOff = !data.delegationModeEnabled;

  return (
    <Page>
      <PageHeader
        kicker="Fees"
        title="Fees affecting your store"
        description="Read-only view of marketplace + tax fees. Handling and Convenience fees can be set when Delegation Mode is enabled by admin."
        actions={null}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Marketplace" title="Set by admin" />
            <MetaList
              cols={1}
              items={[
                { label: 'Platform fee', value: `${(data.platformFeeBp / 100).toFixed(2)}%`, hint: 'Taken off each order before payout' },
                { label: 'Payout cadence', value: `Every ${data.payoutCadenceDays} days` },
                { label: 'GST rate', value: `${(data.gstRateBp / 100).toFixed(2)}%`, hint: 'Statutory' },
                { label: 'TCS rate', value: `${(data.tcsRateBp / 100).toFixed(2)}%`, hint: 'Statutory' },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <SectionHeading kicker="You set" title="Handling & convenience" />
              <Badge tone={delegationOff ? 'neutral' : 'info'}>
                {delegationOff ? 'Delegation off' : 'Delegation on'}
              </Badge>
            </div>
            {delegationOff && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-line bg-bg-2/40 px-3 py-2 text-[12.5px] text-ink-3">
                <Lock className="size-3.5 mt-0.5 shrink-0" />
                <span>Editing locked. Ask admin to enable Delegation Mode for this store.</span>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <Label htmlFor="handling">Handling fee (₹ per order)</Label>
                <Input id="handling" type="number" min="0" value={handling} onChange={(e) => setHandling(e.target.value)} disabled={delegationOff} />
                <p className="mt-1 text-[11.5px] text-ink-3">Currently {formatPaise(data.handlingFeePaise)}.</p>
              </div>
              <div>
                <Label htmlFor="convenience">Convenience fee (₹ per order)</Label>
                <Input id="convenience" type="number" min="0" value={convenience} onChange={(e) => setConvenience(e.target.value)} disabled={delegationOff} />
                <p className="mt-1 text-[11.5px] text-ink-3">Currently {formatPaise(data.convenienceFeePaise)}.</p>
              </div>
              <div className="pt-2">
                <Button
                  variant="accent"
                  disabled={delegationOff}
                  onClick={() => toast.success('Saved (mock)')}
                >
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
