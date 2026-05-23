import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { useStoreScope } from '@/lib/store-scope';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker';
import { FreshnessLabel } from '@/components/ui/freshness-label';

type RevenueSummary = {
  windowStart: string;
  windowEnd: string;
  ordersCount: number;
  refundsCount: number;
  grossPaise: number;
  refundsPaise: number;
  commissionPaise: number;
  tcsPaise: number;
  netOfRefundsPaise: number;
  netOfCommissionPaise: number;
  netMoneyInPaise: number;
};

export default function ReportRevenueSummary() {
  const scope = useStoreScope();
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null });

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (range.from) p.since = range.from.toISOString();
    if (range.to) p.until = range.to.toISOString();
    return p;
  }, [range]);

  const path = `${scope.basePath}/revenue-summary`;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'revenue-summary', scope.basePath, params],
    queryFn: () =>
      api<RevenueSummary>(
        `${path}${Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : ''}`,
      ),
  });
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('revenue_summary', path, params);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Revenue summary"
        description="Gross, refunds, commission, TCS, and net money-in for the selected window."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 max-w-md">
        <DateRangePicker value={range} onChange={setRange} placeholder="Last 30 days" />
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-60" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Orders" value={data.ordersCount.toLocaleString('en-IN')} />
          <Kpi label="Gross" value={formatPaise(data.grossPaise)} />
          <Kpi label="Refunds" value={formatPaise(data.refundsPaise)} sub={`${data.refundsCount} refunds`} />
          <Kpi label="Commission" value={formatPaise(data.commissionPaise)} />
          <Kpi label="TCS" value={formatPaise(data.tcsPaise)} />
          <Kpi label="Net of refunds" value={formatPaise(data.netOfRefundsPaise)} />
          <Kpi label="Net of commission" value={formatPaise(data.netOfCommissionPaise)} />
          <Kpi label="Net money in" value={formatPaise(data.netMoneyInPaise)} accent />
        </div>
      )}
    </Page>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{label}</div>
        <div className={`mt-1 font-mono text-[18px] leading-none ${accent ? 'text-success' : 'text-ink'}`}>{value}</div>
        {sub && <div className="mt-1 text-[11px] text-ink-4">{sub}</div>}
      </CardContent>
    </Card>
  );
}
