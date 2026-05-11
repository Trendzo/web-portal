import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { deliveryMethodLabel, formatPaise } from '@/lib/status';
import type { DeliveryMethod, FeesConfig } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { RoleGate } from '@/components/shell/RoleGate';

export default function AdminFees() {
  return (
    <RoleGate kind="admin" subRole="super_admin">
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'fees'],
    queryFn: () => api<FeesConfig>('/admin/fees'),
  });
  if (isLoading || !data) {
    return <Page><PageHeader title="Fees & charges" /><Skeleton className="h-72" /></Page>;
  }

  return (
    <Page>
      <PageHeader
        kicker="Fees"
        title="Fees & charges"
        description="Marketplace-wide fee configuration. Super-admin only — every change recorded in audit; takes effect on next checkout."
        actions={
          <Button variant="accent" onClick={() => toast.info('Fee editing not yet wired')}>Save changes</Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Platform" title="Default platform fee" />
            <div className="text-[28px] font-semibold text-ink leading-none">{(data.defaultPlatformFeeBp / 100).toFixed(2)}%</div>
            <p className="mt-2 text-[12.5px] text-ink-3">Applied per order to every retailer unless an override is set.</p>
            <div className="mt-5">
              <div className="kicker mb-2">Per-retailer overrides</div>
              {data.platformFeeOverrides.length === 0 ? (
                <p className="text-[12.5px] text-ink-3 italic">None.</p>
              ) : (
                <ul className="space-y-2">
                  {data.platformFeeOverrides.map((o) => (
                    <li key={o.retailerId} className="rounded-md border border-line bg-bg-2/30 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink truncate">{o.retailerName}</span>
                        <Badge tone={o.platformFeeBp < data.defaultPlatformFeeBp ? 'success' : 'warning'}>
                          {(o.platformFeeBp / 100).toFixed(2)}%
                        </Badge>
                      </div>
                      <div className="text-[11.5px] text-ink-3 italic mt-0.5">{o.reason}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Tax" title="GST + TCS" />
            <MetaList
              cols={1}
              items={[
                { label: 'GST rate', value: `${(data.gstRateBp / 100).toFixed(2)}%`, hint: 'Read-only — set by tax authority' },
                { label: 'TCS rate', value: `${(data.tcsRateBp / 100).toFixed(2)}%` },
                { label: 'Intra-state split', value: `CGST ${(data.intraStateSplit.cgstBp / 100).toFixed(2)}% + SGST ${(data.intraStateSplit.sgstBp / 100).toFixed(2)}%` },
                { label: 'Inter-state split', value: `IGST ${(data.interStateSplit.igstBp / 100).toFixed(2)}%` },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <SectionHeading kicker="Logistics" title="Delivery fee table" />
              <span className="text-[12px] text-ink-3">Surge multiplier <strong>{data.surgeMultiplier.toFixed(2)}×</strong></span>
            </div>
            <div className="overflow-hidden rounded-md border border-line">
              <table className="w-full text-[12.5px]">
                <thead className="bg-bg-2/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-ink-3">Method</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Base fee</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-3">Per km</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(data.delivery) as DeliveryMethod[]).map((m) => {
                    const f = data.delivery[m];
                    return (
                      <tr key={m} className="border-t border-line">
                        <td className="px-3 py-2 text-ink">{deliveryMethodLabel(m)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatPaise(f.baseFeePaise)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatPaise(f.perKmFeePaise)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11.5px] text-ink-3">
              Fees feed the Pricing simulator and the Money Split engine. Changing a row here
              recomputes every cart estimate from the next checkout onward.
            </p>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
