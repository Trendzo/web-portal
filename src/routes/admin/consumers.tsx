import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { ConsumerSummary } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Tiny consumer search — by exact email or phone for MVP. Click → wallet + loyalty
 * detail with manual adjustments.
 */
export default function AdminConsumers() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<{ email?: string; phone?: string } | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'consumers', submitted],
    queryFn: () => {
      const params = new URLSearchParams(submitted as Record<string, string>);
      return api<ConsumerSummary[]>(`/admin/loyalty/consumers?${params}`);
    },
    enabled: !!submitted,
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = query.trim();
    if (!v) return;
    if (v.includes('@')) setSubmitted({ email: v });
    else setSubmitted({ phone: v });
  }

  return (
    <Page>
      <PageHeader
        title={<>Consumer balances</>}
        description="Look up a consumer by email or phone to view their wallet, loyalty balance, and recent transactions. Admin can adjust both."
      />

      <form onSubmit={onSubmit} className="mb-6 flex max-w-md gap-3 border-b border-rule pb-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-1 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Email or phone"
            className="!pl-7"
          />
        </div>
      </form>

      {!submitted ? (
        <Empty
          kicker="Search above"
          title="Find a consumer"
          description="Type an exact email or phone (with or without +91) to look up their balances."
        />
      ) : isFetching ? (
        <Skeleton className="h-24" />
      ) : !data || data.length === 0 ? (
        <Empty kicker="No matches" title="No consumer found." />
      ) : (
        <ul className="border-y border-rule divide-y divide-rule" data-stagger>
          {data.map((c) => (
            <li key={c.id}>
              <Link
                to={`/admin/consumers/${c.id}`}
                className="flex items-center justify-between gap-4 px-2 py-5 hover:bg-surface/40 transition-colors group"
              >
                <div className="min-w-0">
                  <div className="font-display italic text-[20px] leading-tight text-ink">{c.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-2">
                    <span>{c.email}</span>
                    <span className="text-ink-4">·</span>
                    <span>{c.phone}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10.5px] tracking-wider text-ink-3">{c.id}</div>
                </div>
                <ArrowUpRight className="size-4 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
