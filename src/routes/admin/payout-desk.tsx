import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, Wallet } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label, FieldError } from '@/components/ui/label';
import { PermissionGate } from '@/components/shell/PermissionGate';

/**
 * Refund legs that need a HUMAN to move real money.
 *
 * A cash-on-delivery refund has no card payment to reverse, so it is paid back as
 * physical cash. Where no cash channel exists — an admin cancelling an already-delivered
 * COD order, say — the leg is deliberately born `pending` and left alone. The system
 * used to mark exactly these "succeeded" with a fabricated reference and move nothing;
 * refusing to do that is only honest if somebody can still close them, which is this page.
 *
 * `cash` rows are legs a driver or store counter has not yet handed over. They usually
 * clear themselves; they appear here so a stale one is visible rather than silent.
 */
type PayoutDeskRow = {
  disbursementId: string;
  refundId: string;
  destination: 'manual_payout' | 'cash' | string;
  amountPaise: number;
  initiatedAt: string;
  ageHours: number;
  settlementNote: string | null;
  refundReason: string | null;
  order: {
    id: string;
    consumerId: string;
    consumerNameSnap: string | null;
    consumerPhoneSnap: string | null;
    paymentMethod: string;
    storeNameSnap: string | null;
  };
};

const QK = ['admin', 'payout-desk'] as const;

const DESTINATION_LABEL: Record<string, string> = {
  manual_payout: 'Manual payout',
  cash: 'Cash — not yet handed over',
};

export default function AdminPayoutDesk() {
  const [tab, setTab] = useState<'all' | 'manual_payout' | 'cash'>('all');
  const [settleTarget, setSettleTarget] = useState<PayoutDeskRow | null>(null);
  const [walletTarget, setWalletTarget] = useState<PayoutDeskRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [...QK, tab],
    queryFn: () =>
      api<PayoutDeskRow[]>(
        `/admin/refunds/payout-desk?limit=200${tab === 'all' ? '' : `&destination=${tab}`}`,
      ),
    refetchInterval: 6000,
  });
  const rows = data ?? [];

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink">Refund payout desk</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
          Refunds we owe that no automatic rail can pay. A cash-on-delivery order has no card
          payment to reverse, so it is refunded in cash — and where nobody is visiting the
          customer, it waits here. Nothing on this list has been paid yet.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="manual_payout">Manual payout</TabsTrigger>
          <TabsTrigger value="cash">Cash owed</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : rows.length === 0 ? (
            <Empty kicker="Clear" title="Nothing is waiting on a payout." />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-bg-2/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-ink-3">Customer</th>
                      <th className="px-3 py-2 text-left font-medium text-ink-3">Store</th>
                      <th className="px-3 py-2 text-left font-medium text-ink-3">Waiting on</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-3">Amount</th>
                      <th className="px-3 py-2 text-left font-medium text-ink-3">Raised</th>
                      <th className="px-3 py-2 text-left font-medium text-ink-3">Reason</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.disbursementId} className="border-t border-line">
                        <td className="px-3 py-2">
                          <div className="text-ink">{r.order.consumerNameSnap ?? '—'}</div>
                          <div className="font-mono text-[11.5px] text-ink-3">
                            {r.order.consumerPhoneSnap ?? ''}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-ink-2">{r.order.storeNameSnap ?? '—'}</td>
                        <td className="px-3 py-2">
                          <Badge tone={r.destination === 'manual_payout' ? 'warning' : 'neutral'}>
                            {DESTINATION_LABEL[r.destination] ?? r.destination}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatPaise(r.amountPaise)}
                        </td>
                        <td className="px-3 py-2 text-[11.5px] text-ink-3">
                          {formatAge(r.initiatedAt)}
                        </td>
                        <td className="px-3 py-2 text-[11.5px] text-ink-3">
                          {r.refundReason ?? r.settlementNote ?? '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          <PermissionGate action="refunds.force">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                iconLeft={<Wallet className="size-3.5" />}
                                onClick={() => setWalletTarget(r)}
                              >
                                To wallet
                              </Button>
                              <Button
                                variant="ink"
                                size="sm"
                                iconLeft={<Banknote className="size-3.5" />}
                                onClick={() => setSettleTarget(r)}
                              >
                                Record payout
                              </Button>
                            </div>
                          </PermissionGate>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {settleTarget && (
        <SettleManualDialog row={settleTarget} onClose={() => setSettleTarget(null)} />
      )}
      {walletTarget && (
        <RedirectToWalletDialog row={walletTarget} onClose={() => setWalletTarget(null)} />
      )}
    </div>
  );
}

/**
 * The 409 the backend raises when someone else closed the leg first. It is a real race,
 * not a bug — two admins can open the desk at once — so say so and re-sync rather than
 * showing a generic failure.
 */
function useDeskError(onClose: () => void) {
  const qc = useQueryClient();
  return (e: unknown, fallback: string): string => {
    if (e instanceof ApiError && e.code === 'disbursement_already_terminal') {
      toast.info('Someone else already settled this one');
      void qc.invalidateQueries({ queryKey: QK });
      onClose();
      return '';
    }
    return e instanceof ApiError ? e.message : fallback;
  };
}

function SettleManualDialog({ row, onClose }: { row: PayoutDeskRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toDeskError = useDeskError(onClose);

  const submit = useMutation({
    mutationFn: () =>
      api(`/admin/refunds/${row.refundId}/disbursements/${row.disbursementId}/settle-manual`, {
        method: 'POST',
        // exactOptionalPropertyTypes: never send `note: undefined`.
        body: { reference: reference.trim(), ...(note.trim() ? { note: note.trim() } : {}) },
      }),
    onSuccess: () => {
      toast.success(`${formatPaise(row.amountPaise)} recorded as paid`);
      void qc.invalidateQueries({ queryKey: QK });
      onClose();
    },
    onError: (e) => setError(toDeskError(e, 'Could not record the payout')),
  });

  return (
    <Dialog open={true} onOpenChange={(o) => !o && !submit.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payout of {formatPaise(row.amountPaise)}</DialogTitle>
          <DialogDescription>
            Only do this once the money has actually left — to{' '}
            {row.order.consumerNameSnap ?? 'the customer'}
            {row.order.consumerPhoneSnap ? ` (${row.order.consumerPhoneSnap})` : ''}. The
            reference is what proves it later, so it is required.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (reference.trim().length < 4) {
              return setError('Enter the payout reference (at least 4 characters).');
            }
            submit.mutate();
          }}
          noValidate
        >
          <div>
            <Label htmlFor="payout-ref" required hint="UTR, UPI ref or bank transaction id">
              Payout reference
            </Label>
            <Input
              id="payout-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
              placeholder="e.g. NEFT-2026080112345"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="payout-note">Note</Label>
            <textarea
              id="payout-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
            />
          </div>
          <FieldError>{error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="ink" caps loading={submit.isPending}>
              Record payout
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RedirectToWalletDialog({ row, onClose }: { row: PayoutDeskRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toDeskError = useDeskError(onClose);

  const submit = useMutation({
    mutationFn: () =>
      api(`/admin/refunds/${row.refundId}/disbursements/${row.disbursementId}/redirect-to-wallet`, {
        method: 'POST',
        body: { ...(note.trim() ? { note: note.trim() } : {}) },
      }),
    onSuccess: () => {
      toast.success(`${formatPaise(row.amountPaise)} added to the customer's wallet`);
      void qc.invalidateQueries({ queryKey: QK });
      onClose();
    },
    onError: (e) => setError(toDeskError(e, 'Could not redirect to wallet')),
  });

  return (
    <Dialog open={true} onOpenChange={(o) => !o && !submit.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {formatPaise(row.amountPaise)} as wallet credit</DialogTitle>
          <DialogDescription>
            This moves real money now: the amount lands in{' '}
            {row.order.consumerNameSnap ?? 'the customer'}&apos;s ClosetX wallet immediately and
            the refund closes. Use it when they are happy to take store credit instead of
            waiting on an offline payout.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            submit.mutate();
          }}
          noValidate
        >
          <div>
            <Label htmlFor="wallet-note">Note</Label>
            <textarea
              id="wallet-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Optional — e.g. customer agreed on call"
              className="mt-1 w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
            />
          </div>
          <FieldError>{error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="ink" caps loading={submit.isPending}>
              Add to wallet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
