import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileText, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { GstReturnFile } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

const KIND_LABEL: Record<GstReturnFile['kind'], string> = {
  gstr1: 'GSTR-1',
  gstr3b: 'GSTR-3B',
  tcs_reconciliation: 'TCS reconciliation',
};

export default function AdminGstReturns() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'gst-returns'],
    queryFn: () => api<GstReturnFile[]>('/admin/gst-returns'),
  });
  const list = data ?? [];

  async function generate(period: string, kind: GstReturnFile['kind']) {
    try {
      await api('/admin/gst-returns/generate', { method: 'POST', body: { period, kind } });
      toast.success(`Generation queued for ${KIND_LABEL[kind]}`);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'gst-returns'] });
    } catch {
      toast.error('Failed to queue generation');
    }
  }

  const grouped = useMemo(() => {
    const byPeriod = new Map<string, GstReturnFile[]>();
    for (const f of list) {
      if (!byPeriod.has(f.period)) byPeriod.set(f.period, []);
      byPeriod.get(f.period)!.push(f);
    }
    return Array.from(byPeriod.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [list]);

  return (
    <Page>
      <PageHeader
        kicker="Invoicing"
        title="GST returns"
        description="Monthly GSTR-1 + GSTR-3B file generator and TCS reconciliation export. Generated files are signed snapshots — re-generation creates a new version."
      />

      {isLoading ? (
        <Skeleton className="h-72" />
      ) : grouped.length === 0 ? (
        <Empty kicker="None" title="No GST returns generated yet." />
      ) : (
        <div className="space-y-4">
          {grouped.map(([period, files]) => (
            <Card key={period}>
              <CardContent className="p-6">
                <SectionHeading kicker={`Period ${period}`} title={new Date(`${period}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} />
                <ul className="space-y-2">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-ink-3" />
                        <span className="text-[13px] font-medium text-ink">{KIND_LABEL[f.kind]}</span>
                        <Badge tone={f.status === 'ready' ? 'success' : f.status === 'generating' ? 'info' : f.status === 'failed' ? 'danger' : 'warning'}>
                          {f.status}
                        </Badge>
                        {f.generatedAt && <span className="text-[11px] text-ink-4">generated {formatAge(f.generatedAt)}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {f.status === 'ready' && f.downloadUrl ? (
                          <Button asChild size="sm" variant="outline" iconLeft={<Download className="size-3.5" />}>
                            <a href={f.downloadUrl}>Download</a>
                          </Button>
                        ) : (
                          <Button size="sm" variant="accent" iconLeft={<Sparkles className="size-3.5" />} onClick={() => void generate(period, f.kind)}>
                            Generate
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
