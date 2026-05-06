import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, IndianRupee, Sparkles } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type {
  ConsumerWallet,
  LoyaltyTier,
  LoyaltyTransaction,
  WalletTransaction,
} from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';

type WalletPayload = { wallet: ConsumerWallet | null; transactions: WalletTransaction[] };
type LoyaltyPayload = {
  balancePoints: number;
  lifetimeEarned: number;
  tier: LoyaltyTier;
  transactions: LoyaltyTransaction[];
};

export default function AdminConsumerDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [adjusting, setAdjusting] = useState<'wallet' | 'loyalty' | null>(null);

  const wallet = useQuery({
    queryKey: ['admin', 'consumer-wallet', id],
    queryFn: () => api<WalletPayload>(`/admin/loyalty/consumers/${id}/wallet`),
  });
  const loyalty = useQuery({
    queryKey: ['admin', 'consumer-loyalty', id],
    queryFn: () => api<LoyaltyPayload>(`/admin/loyalty/consumers/${id}/loyalty`),
  });

  const refetch = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'consumer-wallet', id] });
    void qc.invalidateQueries({ queryKey: ['admin', 'consumer-loyalty', id] });
  };

  return (
    <Page>
      <Link
        to="/admin/consumers"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All consumers
      </Link>

      <PageHeader
        title={<>Consumer balances</>}
        description={<>ID <span className="font-mono text-[13px]">{id}</span></>}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Wallet</CardTitle>
              <p className="text-[12px] text-ink-3 mt-0.5">Cash balance, in paise</p>
            </div>
            <IndianRupee className="size-5 text-ink-3" />
          </CardHeader>
          <CardContent>
            {wallet.isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <>
                <div className="font-display italic text-[44px] leading-none text-ink">
                  {formatPaise(wallet.data?.wallet?.balancePaise ?? 0)}
                </div>
                <div className="mt-3 text-[11.5px] uppercase tracking-[0.16em] text-ink-3">
                  Wallet ID{' '}
                  <span className="font-mono normal-case tracking-normal">
                    {wallet.data?.wallet?.id ?? '—'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  caps
                  className="mt-4"
                  onClick={() => setAdjusting('wallet')}
                >
                  Adjust balance
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Loyalty</CardTitle>
              <p className="text-[12px] text-ink-3 mt-0.5">Points + tier</p>
            </div>
            <Sparkles className="size-5 text-ink-3" />
          </CardHeader>
          <CardContent>
            {loyalty.isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <>
                <div className="flex items-baseline gap-3">
                  <div className="font-display italic text-[44px] leading-none text-ink">
                    {(loyalty.data?.balancePoints ?? 0).toLocaleString('en-IN')}
                  </div>
                  <Badge tone="info" className="!transform-none">
                    {loyalty.data?.tier ?? 'bronze'}
                  </Badge>
                </div>
                <div className="mt-3 text-[11.5px] uppercase tracking-[0.16em] text-ink-3">
                  Lifetime earned{' '}
                  <span className="font-mono normal-case tracking-normal">
                    {(loyalty.data?.lifetimeEarned ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  caps
                  className="mt-4"
                  onClick={() => setAdjusting('loyalty')}
                >
                  Adjust points
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <SectionHeading title="Wallet transactions" hint={`${wallet.data?.transactions.length ?? 0} recent`} />
      <TransactionsTable
        loading={wallet.isLoading}
        rows={(wallet.data?.transactions ?? []).map((t) => ({
          id: t.id,
          when: t.at,
          kind: t.kind,
          amount: formatPaise(t.amountPaise),
          balance: formatPaise(t.balanceAfterPaise),
          note: t.note,
        }))}
      />

      <div className="mt-12">
        <SectionHeading
          title="Loyalty transactions"
          hint={`${loyalty.data?.transactions.length ?? 0} recent`}
        />
      </div>
      <TransactionsTable
        loading={loyalty.isLoading}
        rows={(loyalty.data?.transactions ?? []).map((t) => ({
          id: t.id,
          when: t.at,
          kind: t.kind,
          amount: `${t.points > 0 ? '+' : ''}${t.points} pts`,
          balance: `${t.balanceAfterPoints} pts`,
          note: t.note,
        }))}
      />

      {adjusting === 'wallet' && (
        <AdjustDialog
          kind="wallet"
          consumerId={id}
          onClose={() => setAdjusting(null)}
          onDone={refetch}
        />
      )}
      {adjusting === 'loyalty' && (
        <AdjustDialog
          kind="loyalty"
          consumerId={id}
          onClose={() => setAdjusting(null)}
          onDone={refetch}
        />
      )}
    </Page>
  );
}

function TransactionsTable({
  loading,
  rows,
}: {
  loading: boolean;
  rows: Array<{
    id: string;
    when: string;
    kind: string;
    amount: string;
    balance: string;
    note: string | null;
  }>;
}) {
  if (loading) return <Skeleton className="h-32" />;
  if (rows.length === 0) {
    return (
      <p className="border border-dashed border-rule-strong py-8 text-center text-[13px] text-ink-3 italic">
        No transactions yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto border border-rule">
      <table className="w-full text-[13px]">
        <thead className="bg-paper-2/40">
          <tr>
            <th className="px-3 py-2 text-left kicker text-ink-3">When</th>
            <th className="px-3 py-2 text-left kicker text-ink-3">Kind</th>
            <th className="px-3 py-2 text-right kicker text-ink-3">Amount</th>
            <th className="px-3 py-2 text-right kicker text-ink-3">Balance after</th>
            <th className="px-3 py-2 text-left kicker text-ink-3">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2.5 text-ink-2">{new Date(r.when).toLocaleString('en-IN')}</td>
              <td className="px-3 py-2.5">
                <span className="kicker text-ink-3">{r.kind.replace('_', ' ')}</span>
              </td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">{r.amount}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-2">{r.balance}</td>
              <td className="px-3 py-2.5 text-ink-2">{r.note ?? <span className="text-ink-4">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdjustDialog({
  kind,
  consumerId,
  onClose,
  onDone,
}: {
  kind: 'wallet' | 'loyalty';
  consumerId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const submit = useMutation({
    mutationFn: () => {
      const path =
        kind === 'wallet'
          ? `/admin/loyalty/consumers/${consumerId}/wallet/adjust`
          : `/admin/loyalty/consumers/${consumerId}/loyalty/adjust`;
      const body =
        kind === 'wallet'
          ? { amountPaise: Number(amount), note: note.trim() }
          : { points: Number(amount), note: note.trim() };
      return api(path, { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success(`${kind === 'wallet' ? 'Wallet' : 'Loyalty'} adjusted`);
      onClose();
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {kind === 'wallet' ? 'wallet' : 'loyalty'} balance</DialogTitle>
          <DialogDescription>
            Positive credits, negative debits. {kind === 'wallet' ? 'Amount in paise.' : 'Points.'} A note is required.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label required>{kind === 'wallet' ? 'Amount (paise)' : 'Points'}</Label>
            <Input
              mono
              type="number"
              placeholder={kind === 'wallet' ? 'e.g. 10000 or -5000' : 'e.g. 100 or -50'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label required>Note</Label>
            <Textarea rows={2} placeholder="Why this adjustment?" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="ink"
            caps
            loading={submit.isPending}
            disabled={!amount || !note.trim()}
            onClick={() => submit.mutate()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
