import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { dataExportStatusMeta, formatAge } from '@/lib/status';
import type { DataExportRequest } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';

export default function AdminDataExports() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'data-exports'],
    queryFn: () => api<DataExportRequest[]>('/admin/compliance/data-exports'),
  });
  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        kicker="Compliance"
        title="Data exports"
        description="Consumer GDPR archive requests. Build the bundle, deliver, and track expiry."
      />

      {isLoading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <Empty kicker="Nothing pending" title="No pending data export requests." />
      ) : (
        <ul className="space-y-2">
          {list.map((e) => {
            const meta = dataExportStatusMeta(e.status);
            return (
              <Card key={e.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CopyableId value={e.consumerId} label="consumer" />
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <div className="mt-1 text-[11.5px] text-ink-4">
                      Requested {formatAge(e.requestedAt)}
                      {e.readyAt && <span> · Ready {formatAge(e.readyAt)}</span>}
                      {e.expiresAt && <span> · Expires {new Date(e.expiresAt).toLocaleDateString()}</span>}
                    </div>
                    {e.failureReason && (
                      <div className="mt-1 text-[12px] text-danger">{e.failureReason}</div>
                    )}
                  </div>
                  {e.status === 'ready' && e.downloadUrl ? (
                    <Button asChild variant="outline" size="sm" iconLeft={<Download className="size-3.5" />}>
                      <a href={e.downloadUrl}>Download</a>
                    </Button>
                  ) : e.status === 'pending' ? (
                    <Button variant="outline" size="sm">Build archive</Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
