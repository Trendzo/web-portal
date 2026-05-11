import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { consumerStatusMeta } from '@/lib/status';
import type { ConsumerStatus, ConsumerSummary } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS: ReadonlyArray<{ value: ConsumerStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All consumers' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'closed', label: 'Closed' },
];

export default function AdminConsumers() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ConsumerStatus | 'all'>('all');
  const [signupRange, setSignupRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [banFilter, setBanFilter] = useState<'all' | 'community' | 'reviews' | 'rewards'>('all');
  const [submitted, setSubmitted] = useState<{ q?: string; status?: ConsumerStatus } | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'consumers', submitted],
    queryFn: () => {
      const params = new URLSearchParams();
      if (submitted?.q) params.set('q', submitted.q);
      if (submitted?.status) params.set('status', submitted.status);
      return api<ConsumerSummary[]>(`/admin/consumers?${params}`);
    },
    enabled: submitted !== null,
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted({
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(status !== 'all' ? { status } : {}),
    });
  }

  function onStatusChange(v: string) {
    const newStatus = v as ConsumerStatus | 'all';
    setStatus(newStatus);
    setSubmitted({
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(newStatus !== 'all' ? { status: newStatus } : {}),
    });
  }

  return (
    <Page>
      <PageHeader
        title={<>Consumers</>}
        description="Search by name, email, or phone. Click a row to view the full profile, wallet, loyalty, and account actions."
      />

      <form onSubmit={onSubmit} className="mb-6 flex flex-wrap items-end gap-3 border-b border-rule pb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email or phone"
            className="!pl-7"
          />
        </div>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={signupRange} onValueChange={(v) => setSignupRange(v as typeof signupRange)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All signups</SelectItem>
            <SelectItem value="7d">Signed up · last 7d</SelectItem>
            <SelectItem value="30d">Signed up · last 30d</SelectItem>
            <SelectItem value="90d">Signed up · last 90d</SelectItem>
          </SelectContent>
        </Select>
        <Select value={banFilter} onValueChange={(v) => setBanFilter(v as typeof banFilter)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All flags</SelectItem>
            <SelectItem value="community">Community-banned</SelectItem>
            <SelectItem value="reviews">Reviews-banned</SelectItem>
            <SelectItem value="rewards">Rewards-banned</SelectItem>
          </SelectContent>
        </Select>
      </form>

      {submitted === null ? (
        <Empty
          kicker="Search above"
          title="Find a consumer"
          description="Type a name, email, or phone number to begin. Use the status filter to scope results."
        />
      ) : isFetching ? (
        <Skeleton className="h-32" />
      ) : !data || data.length === 0 ? (
        <Empty kicker="No matches" title="No consumers found." />
      ) : (
        <ul className="border-y border-rule divide-y divide-rule" data-stagger>
          {data
            .filter((c) => {
              if (signupRange === 'all') return true;
              const ageMs = Date.now() - new Date(c.signupAt).getTime();
              const days = ageMs / (1000 * 60 * 60 * 24);
              return signupRange === '7d' ? days <= 7 : signupRange === '30d' ? days <= 30 : days <= 90;
            })
            .filter(() => banFilter === 'all' || true /* MOCK §20: no ban field on API yet */)
            .map((c) => {
            const meta = consumerStatusMeta(c.status);
            return (
              <li key={c.id}>
                <Link
                  to={`/admin/consumers/${c.id}`}
                  className="flex items-center justify-between gap-4 px-2 py-4 hover:bg-surface/40 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display italic text-[18px] leading-tight text-ink">{c.name}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-2">
                      <span>{c.email}</span>
                      <span className="text-ink-4">·</span>
                      <span>{c.phone}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] tracking-wider text-ink-4">
                      {c.id} · joined {new Date(c.signupAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
