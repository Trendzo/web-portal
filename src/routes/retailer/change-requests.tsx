import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { changeRequestStatusMeta, formatAge } from '@/lib/status';
import type { ChangeRequest, ChangeRequestCurrentValues, ChangeRequestField } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FIELD_OPTIONS: { value: ChangeRequestField; label: string }[] = [
  { value: 'legal_name', label: 'Legal name' },
  { value: 'address', label: 'Address' },
  { value: 'bank_account', label: 'Bank account' },
  { value: 'gstin', label: 'GSTIN' },
];

function fieldLabel(f: ChangeRequestField): string {
  if (f === 'pos_billing_activation') return 'POS billing activation';
  return FIELD_OPTIONS.find((o) => o.value === f)?.label ?? f;
}

function summariseRequestedValue(cr: ChangeRequest): string {
  if (cr.field !== 'bank_account') return cr.requestedValue;
  try {
    const parsed = JSON.parse(cr.requestedValue) as { accountNumber: string; ifsc: string; legalName: string };
    return `${parsed.legalName} · ${parsed.accountNumber} · ${parsed.ifsc}`;
  } catch {
    return cr.requestedValue;
  }
}

function summariseCurrentValue(cr: ChangeRequest): string {
  if (cr.field !== 'bank_account') return cr.currentValue || '—';
  try {
    const parsed = JSON.parse(cr.currentValue) as { accountNumber: string; ifsc: string; legalName: string };
    return `${parsed.legalName} · ${parsed.accountNumber} · ${parsed.ifsc}`;
  } catch {
    return cr.currentValue || '—';
  }
}

export default function RetailerChangeRequests() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'change-requests'],
    queryFn: () => api<ChangeRequest[]>('/retailer/change-requests'),
  });
  const list = data ?? [];

  const pendingFields = useMemo(
    () => new Set(list.filter((cr) => cr.status === 'pending').map((cr) => cr.field)),
    [list],
  );

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
                        <span className="text-[14px] font-semibold text-ink">{fieldLabel(cr.field)}</span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <div className="mt-1 text-[12.5px] text-ink-2">
                        <span className="text-ink-3">From:</span> {summariseCurrentValue(cr)}
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-ink-2">
                        <span className="text-ink-3">To:</span> {summariseRequestedValue(cr)}
                      </div>
                      {cr.reason && (
                        <div className="mt-1 text-[12px] text-ink-3 italic">"{cr.reason}"</div>
                      )}
                      <div className="mt-1 text-[11.5px] text-ink-4">
                        Submitted {formatAge(cr.submittedAt)}
                        {cr.decisionNote && <span> · Note: <em>{cr.decisionNote}</em></span>}
                      </div>
                      {cr.evidenceUrl && (
                        <a
                          className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-link hover:underline"
                          href={cr.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Evidence <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}

      <SubmitChangeRequestDialog
        open={open}
        onClose={() => setOpen(false)}
        pendingFields={pendingFields}
        onSubmitted={() => {
          qc.invalidateQueries({ queryKey: ['retailer', 'change-requests'] });
          setOpen(false);
        }}
      />
    </Page>
  );
}

function SubmitChangeRequestDialog({
  open,
  onClose,
  pendingFields,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  pendingFields: Set<ChangeRequestField>;
  onSubmitted: () => void;
}) {
  const [field, setField] = useState<ChangeRequestField>('legal_name');
  const [reason, setReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankLegalName, setBankLegalName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const current = useQuery({
    queryKey: ['retailer', 'change-requests', 'current-values'],
    queryFn: () =>
      api<ChangeRequestCurrentValues>('/retailer/change-requests/current-values'),
    enabled: open,
  });

  const submit = useMutation({
    mutationFn: (body: {
      field: ChangeRequestField;
      currentValue: string;
      requestedValue: string;
      reason: string;
      evidenceUrl?: string;
    }) => api('/retailer/change-requests', { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Change request submitted.');
      resetState();
      onSubmitted();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Submit failed'),
  });

  function resetState() {
    setField('legal_name');
    setReason('');
    setEvidenceUrl('');
    setLegalName('');
    setAddress('');
    setGstin('');
    setBankAccountNumber('');
    setBankIfsc('');
    setBankLegalName('');
    setErrors({});
  }

  function buildCurrentValue(): string {
    if (!current.data) return '—';
    if (field === 'legal_name') return current.data.legalName;
    if (field === 'address') return current.data.address;
    if (field === 'gstin') return current.data.gstin;
    // bank_account: store the current bank as JSON so admin can render structurally.
    return current.data.bank ? JSON.stringify(current.data.bank) : '—';
  }

  function buildRequestedValue(): { value: string | null; error?: string } {
    if (field === 'legal_name') {
      const v = legalName.trim();
      if (!v) return { value: null, error: 'New legal name required' };
      if (v.length > 200) return { value: null, error: 'Max 200 characters' };
      return { value: v };
    }
    if (field === 'address') {
      const v = address.trim();
      if (!v) return { value: null, error: 'New address required' };
      if (v.length > 500) return { value: null, error: 'Max 500 characters' };
      return { value: v };
    }
    if (field === 'gstin') {
      const v = gstin.trim().toUpperCase();
      if (!/^[0-9A-Z]{15}$/.test(v)) return { value: null, error: 'GSTIN must be 15 alphanumeric characters' };
      return { value: v };
    }
    // bank_account
    const acc = bankAccountNumber.trim();
    const ifsc = bankIfsc.trim().toUpperCase();
    const ln = bankLegalName.trim();
    if (acc.length < 6) return { value: null, error: 'Account number too short' };
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return { value: null, error: 'IFSC format invalid' };
    if (!ln) return { value: null, error: 'Legal name on the account is required' };
    return {
      value: JSON.stringify({ accountNumber: acc, ifsc, legalName: ln }),
    };
  }

  function handleSubmit() {
    const fieldErrors: Record<string, string> = {};
    if (reason.trim().length < 3) fieldErrors.reason = 'Reason must be at least 3 characters';
    if (evidenceUrl.trim() && !/^https?:\/\/\S+$/i.test(evidenceUrl.trim())) {
      fieldErrors.evidenceUrl = 'Must be a valid URL or left blank';
    }
    const built = buildRequestedValue();
    if (built.error) fieldErrors.value = built.error;
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0 || !built.value) return;

    submit.mutate({
      field,
      currentValue: buildCurrentValue(),
      requestedValue: built.value,
      reason: reason.trim(),
      ...(evidenceUrl.trim() ? { evidenceUrl: evidenceUrl.trim() } : {}),
    });
  }

  const blockedReason = pendingFields.has(field)
    ? `A pending ${fieldLabel(field).toLowerCase()} request already exists. Wait for admin decision before submitting another.`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetState(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit field change request</DialogTitle>
          <DialogDescription>
            Choose which verified field to change and enter the new value. Admin will review and may
            ask for supporting documents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <Label htmlFor="cr-field" required>Field</Label>
            <Select value={field} onValueChange={(v) => { setField(v as ChangeRequestField); setErrors({}); }}>
              <SelectTrigger id="cr-field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {blockedReason ? (
            <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-[12.5px] text-warning">
              {blockedReason}
            </div>
          ) : (
            <>
              <div className="rounded-md border border-line bg-bg-2/40 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-ink-3 mb-1">Current value</div>
                <div className="text-[13px] text-ink-2 break-all">
                  {current.isLoading ? '…' : buildCurrentValue()}
                </div>
              </div>

              {field === 'legal_name' && (
                <div>
                  <Label htmlFor="cr-legal" required>New legal name</Label>
                  <Input id="cr-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} maxLength={200} />
                </div>
              )}
              {field === 'address' && (
                <div>
                  <Label htmlFor="cr-address" required>New address</Label>
                  <Textarea id="cr-address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} />
                </div>
              )}
              {field === 'gstin' && (
                <div>
                  <Label htmlFor="cr-gstin" required hint="15 characters, e.g. 27ABCDE1234F1Z5">New GSTIN</Label>
                  <Input
                    id="cr-gstin"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    maxLength={15}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
              )}
              {field === 'bank_account' && (
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="cr-bank-name" required>Account holder legal name</Label>
                    <Input id="cr-bank-name" value={bankLegalName} onChange={(e) => setBankLegalName(e.target.value)} maxLength={200} />
                  </div>
                  <div>
                    <Label htmlFor="cr-bank-acc" required>Account number</Label>
                    <Input id="cr-bank-acc" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} maxLength={34} />
                  </div>
                  <div>
                    <Label htmlFor="cr-bank-ifsc" required hint="11 chars, e.g. HDFC0001234">IFSC</Label>
                    <Input
                      id="cr-bank-ifsc"
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                      maxLength={11}
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>
                </div>
              )}
              {errors.value && <FieldError>{errors.value}</FieldError>}

              <div>
                <Label htmlFor="cr-reason" required>Reason</Label>
                <Textarea
                  id="cr-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you need to update this field."
                  maxLength={500}
                />
                {errors.reason && <FieldError>{errors.reason}</FieldError>}
              </div>

              <div>
                <Label htmlFor="cr-evidence" hint="Optional — link to a passbook scan, incorporation cert, etc.">
                  Evidence URL
                </Label>
                <Input
                  id="cr-evidence"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://"
                />
                {errors.evidenceUrl && <FieldError>{errors.evidenceUrl}</FieldError>}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); resetState(); }}>Cancel</Button>
          <Button
            variant="ink"
            onClick={handleSubmit}
            loading={submit.isPending}
            disabled={submit.isPending || Boolean(blockedReason)}
          >
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
