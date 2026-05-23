import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta } from '@/lib/report';
import { useStoreScope } from '@/lib/store-scope';
import {
  type ComplianceResponse,
  type ComplianceVerdict,
  verdictTone,
} from '@/lib/compliance-floors';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FreshnessLabel } from '@/components/ui/freshness-label';

function bp(n: number) { return `${(n / 100).toFixed(1)}%`; }
function msDuration(ms: number) {
  if (ms <= 0) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function ReportCompliance() {
  const scope = useStoreScope();
  const path = `${scope.basePath}/compliance`;

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'compliance', scope.basePath],
    queryFn: () => api<ComplianceResponse>(path),
  });
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('compliance', path);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Compliance — trailing 30 days"
        description="Acceptance, fulfilment, dispute, and return rates against platform floors."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
              Export CSV
            </Button>
          </>
        }
      />

      {isLoading || !data ? (
        <Skeleton className="h-60" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Acceptance"
            value={bp(data.metrics.acceptance.valueBp)}
            floor={data.metrics.acceptance.floorBp ? `floor ${bp(data.metrics.acceptance.floorBp)}` : ''}
            sub={`avg accept ${msDuration(data.metrics.acceptance.avgAcceptMs ?? 0)}`}
            verdict={data.metrics.acceptance.verdict}
          />
          <MetricCard
            label="Fulfilment"
            value={bp(data.metrics.fulfilment.valueBp)}
            floor={data.metrics.fulfilment.floorBp ? `floor ${bp(data.metrics.fulfilment.floorBp)}` : ''}
            sub={`avg end-to-end ${msDuration(data.metrics.fulfilment.avgEndToEndMs ?? 0)}`}
            verdict={data.metrics.fulfilment.verdict}
          />
          <MetricCard
            label="Dispute rate"
            value={bp(data.metrics.disputeRate.valueBp)}
            floor={data.metrics.disputeRate.ceilBp ? `ceil ${bp(data.metrics.disputeRate.ceilBp)}` : ''}
            sub={`${data.metrics.disputeRate.count ?? 0} disputes`}
            verdict={data.metrics.disputeRate.verdict}
          />
          <MetricCard
            label="Return rate"
            value={bp(data.metrics.returnRate.valueBp)}
            floor={data.metrics.returnRate.ceilBp ? `ceil ${bp(data.metrics.returnRate.ceilBp)}` : ''}
            sub={`${data.metrics.returnRate.count ?? 0} returns`}
            verdict={data.metrics.returnRate.verdict}
          />
        </div>
      )}

      {data && (
        <div className="mt-4 text-[11.5px] text-ink-4">
          Window: {new Date(data.windowStart).toLocaleDateString('en-IN')} →{' '}
          {new Date(data.windowEnd).toLocaleDateString('en-IN')} · {data.ordersTotal} orders ·{' '}
          {data.itemsTotal} items.
        </div>
      )}
    </Page>
  );
}

function MetricCard({
  label,
  value,
  floor,
  sub,
  verdict,
}: {
  label: string;
  value: string;
  floor: string;
  sub: string;
  verdict: ComplianceVerdict;
}) {
  const tone = verdictTone(verdict);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-[11.5px] uppercase tracking-wide text-ink-3">{label}</div>
          <Badge tone={tone} flat>{verdict}</Badge>
        </div>
        <div className="mt-1 font-mono text-[20px] text-ink leading-none">{value}</div>
        <div className="mt-1 text-[11px] text-ink-4 font-mono">{floor}</div>
        <div className="mt-2 text-[11.5px] text-ink-3">{sub}</div>
      </CardContent>
    </Card>
  );
}
