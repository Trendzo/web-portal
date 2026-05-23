import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { dataExportStatusMeta, formatAge } from '@/lib/status';
import type { DataExportRequest } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdminDataExports() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'data-exports'],
    queryFn: () => api<DataExportRequest[]>('/admin/compliance/data-exports'),
  });

  const [building, setBuilding] = useState<DataExportRequest | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [failing, setFailing] = useState<DataExportRequest | null>(null);
  const [failureReason, setFailureReason] = useState('');

  const process = useMutation({
    mutationFn: (body: {
      id: string;
      status: 'building' | 'ready' | 'failed';
      downloadUrl?: string;
      failureReason?: string;
    }) => api(`/admin/compliance/data-exports/${body.id}/process`, { method: 'POST', body }),
    onSuccess: (_d, vars) => {
      const noun = vars.status === 'ready' ? 'published' : vars.status === 'failed' ? 'marked failed' : 'building';
      toast.success(`Export ${noun}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'data-exports'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'data-exports'] });
      setBuilding(null);
      setFailing(null);
      setDownloadUrl('');
      setFailureReason('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
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
                      <span className="text-[14px] font-medium text-ink truncate">
                        {e.consumerName ?? e.consumerEmail ?? `Consumer ${e.consumerId}`}
                      </span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-3">
                      {e.consumerEmail ?? '—'}
                      {e.consumerPhone ? ` · ${e.consumerPhone}` : ''}
                      <span className="ml-2"><CopyableId value={e.consumerId} label="consumer id" /></span>
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
                  <div className="flex flex-wrap gap-2">
                    {e.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        loading={process.isPending && process.variables?.id === e.id && process.variables?.status === 'building'}
                        onClick={() => process.mutate({ id: e.id, status: 'building' })}
                      >
                        Start build
                      </Button>
                    )}
                    {e.status === 'building' && (
                      <Button variant="outline" size="sm" onClick={() => setBuilding(e)}>
                        Publish archive
                      </Button>
                    )}
                    {(e.status === 'pending' || e.status === 'building') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger/5"
                        onClick={() => setFailing(e)}
                      >
                        Mark failed
                      </Button>
                    )}
                    {e.status === 'ready' && e.downloadUrl && (
                      <Button asChild variant="outline" size="sm" iconLeft={<Download className="size-3.5" />}>
                        <a href={e.downloadUrl} target="_blank" rel="noreferrer">Download</a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}

      <Dialog open={building !== null} onOpenChange={(o) => !o && setBuilding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish archive</DialogTitle>
            <DialogDescription>
              Paste the signed URL of the built archive. Consumer can download from here. Default expiry 7 days.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="export-url" required>Download URL</Label>
            <Input
              id="export-url"
              value={downloadUrl}
              onChange={(ev) => setDownloadUrl(ev.target.value)}
              placeholder="https://signed.url/…"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBuilding(null)}>Cancel</Button>
            <Button
              variant="accent"
              loading={process.isPending}
              disabled={!downloadUrl.trim().startsWith('http')}
              onClick={() =>
                building &&
                process.mutate({
                  id: building.id,
                  status: 'ready',
                  downloadUrl: downloadUrl.trim(),
                })
              }
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={failing !== null} onOpenChange={(o) => !o && setFailing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark export failed</DialogTitle>
            <DialogDescription>
              Records the failure so the consumer knows. Provide a short reason for the audit log.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="export-fail" required>Reason</Label>
            <Input
              id="export-fail"
              value={failureReason}
              onChange={(ev) => setFailureReason(ev.target.value)}
              placeholder="e.g. archive generation timeout"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFailing(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={process.isPending}
              disabled={failureReason.trim().length < 3}
              iconLeft={<X className="size-3.5" />}
              onClick={() =>
                failing &&
                process.mutate({
                  id: failing.id,
                  status: 'failed',
                  failureReason: failureReason.trim(),
                })
              }
            >
              Mark failed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
