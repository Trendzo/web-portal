import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { changeRequestStatusMeta, formatAge } from '@/lib/status';
import type { ChangeRequest } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { ClarificationRequestDialog } from '@/components/admin/clarification-request-dialog';

const FIELD_OPTIONS = [
  { value: 'legal_name', label: 'Legal name' },
  { value: 'address', label: 'Address' },
  { value: 'bank_account', label: 'Bank account' },
  { value: 'gstin', label: 'GSTIN' },
];

export default function RetailerChangeRequests() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'change-requests'],
    queryFn: () => api<ChangeRequest[]>('/retailer/change-requests'),
  });
  const list = data ?? [];

  const submitRequest = useMutation({
    mutationFn: ({ fieldKey, question }: { fieldKey: string; question: string }) =>
      api('/retailer/change-requests', {
        method: 'POST',
        body: JSON.stringify({ field: fieldKey, currentValue: '—', requestedValue: question }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retailer', 'change-requests'] });
      toast.success('Change request submitted.');
      setOpen(false);
    },
  });

  return (
    <Page>
      <PageHeader
        kicker="Compliance"
        title="Change requests"
        description="Verified fields (legal name, address, bank, GSTIN) need admin approval before they update. Submit a request and track its status here."
        actions={
          <Button iconLeft={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
            New request
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : list.length === 0 ? (
        <Empty kicker="No requests" title="No change requests submitted yet." />
      ) : (
        <ul className="space-y-2">
          {list.map((cr) => {
            const meta = changeRequestStatusMeta(cr.status);
            return (
              <Card key={cr.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-ink capitalize">{cr.field.replace(/_/g, ' ')}</span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <div className="mt-1 text-[12.5px] text-ink-2">
                        <span className="text-ink-3">From:</span> {cr.currentValue}
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-ink-2">
                        <span className="text-ink-3">To:</span> {cr.requestedValue}
                      </div>
                      <div className="mt-1 text-[11.5px] text-ink-4">
                        Submitted {formatAge(cr.submittedAt)}
                        {cr.decisionNote && <span> · Note: <em>{cr.decisionNote}</em></span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}

      <ClarificationRequestDialog
        open={open}
        title="Submit field change request"
        description="Choose which verified field to change and explain why. Admin will review and may ask for supporting documents."
        fields={FIELD_OPTIONS}
        onClose={() => setOpen(false)}
        onConfirm={({ fieldKey, question }) => {
          submitRequest.mutate({ fieldKey, question });
        }}
      />
    </Page>
  );
}
