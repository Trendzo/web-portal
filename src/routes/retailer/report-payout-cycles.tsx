import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { useServerCsv } from '@/lib/csv';
import { unwrapMeta, unwrapRows } from '@/lib/report';
import { useStoreScope } from '@/lib/store-scope';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { FreshnessLabel } from '@/components/ui/freshness-label';

type Cycle = {
  id: string;
  status: string;
  cycleStart: string;
  cycleEnd: string;
  grossPaise: number;
  commissionPaise: number;
  refundsHeldPaise: number;
  adjustmentsPaise: number;
  disputeHoldPaise: number;
  netPaise: number;
  breakdown: Record<string, number>;
};

export default function ReportPayoutCycles() {
  const scope = useStoreScope();
  const path = `${scope.basePath}/payouts/cycles`;
  const params = { limit: '24' };

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'payout-cycles', scope.basePath],
    queryFn: () => api<unknown>(`${path}?limit=24`),
  });
  const rows = unwrapRows<Cycle>(data);
  const meta = unwrapMeta(data);
  const exportCsv = useServerCsv('payout_cycles', path, params);

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Page>
      <PageHeader
        kicker="Reports"
        title="Payout cycles"
        description="Gross, commission, TCS, refunds-held, dispute-hold, adjustments, and net for each cycle."
        actions={
          <>
            <FreshnessLabel generatedAtIst={meta?.generatedAtIst} />
            <Button variant="outline" size="sm" iconLeft={<Download className="size-3.5" />} onClick={() => exportCsv()}>
              Export CSV
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Empty kicker="No cycles" title="No payout cycles found." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 w-6"></th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Cycle</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Gross</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Commission</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Refunds held</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Dispute hold</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Adjustments</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = expanded === r.id;
                  return (
                    <>
                      <tr
                        key={r.id}
                        className="border-t border-line cursor-pointer hover:bg-bg-2/20"
                        onClick={() => setExpanded(open ? null : r.id)}
                      >
                        <td className="px-3 py-2 text-ink-3">
                          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </td>
                        <td className="px-3 py-2 font-mono text-ink-2 text-[11.5px]">
                          {new Date(r.cycleStart).toLocaleDateString('en-IN')} → {new Date(r.cycleEnd).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-3 py-2"><Badge tone="neutral" flat>{r.status}</Badge></td>
                        <td className="px-3 py-2 text-right font-mono">{formatPaise(r.grossPaise)}</td>
                        <td className="px-3 py-2 text-right font-mono text-warning">−{formatPaise(r.commissionPaise)}</td>
                        <td className="px-3 py-2 text-right font-mono text-warning">−{formatPaise(r.refundsHeldPaise)}</td>
                        <td className="px-3 py-2 text-right font-mono text-warning">−{formatPaise(r.disputeHoldPaise)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatPaise(r.adjustmentsPaise)}</td>
                        <td className="px-3 py-2 text-right font-mono text-success">{formatPaise(r.netPaise)}</td>
                      </tr>
                      {open && (
                        <tr key={`${r.id}-detail`} className="border-t border-line bg-bg-2/20">
                          <td></td>
                          <td colSpan={8} className="px-3 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-[11.5px]">
                              {Object.entries(r.breakdown).map(([k, v]) => (
                                <div key={k} className="font-mono">
                                  <div className="text-ink-3">{k}</div>
                                  <div className={v < 0 ? 'text-warning' : 'text-ink'}>{formatPaise(v)}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
