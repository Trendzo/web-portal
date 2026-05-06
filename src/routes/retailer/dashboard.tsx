import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2, Clock, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { retailerStatusMeta, storeStatusMeta } from '@/lib/status';
import type { RetailerProfile, Store } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

type MeResponse = { retailer: RetailerProfile; store: Store | null };

export default function RetailerDashboard() {
  const session = useAuth((s) => s.session);
  const patchRetailer = useAuth((s) => s.patchRetailer);
  const fallback = session?.kind === 'retailer' ? session.retailer : null;

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });

  if (data?.retailer && fallback && data.retailer.status !== fallback.status) {
    patchRetailer({ status: data.retailer.status, storeId: data.retailer.storeId });
  }

  const retailer = data?.retailer ?? fallback;
  const store = data?.store ?? null;

  if (!retailer) {
    return (
      <Page>
        <Skeleton className="h-12 w-2/3" />
      </Page>
    );
  }

  const rMeta = retailerStatusMeta(retailer.status);
  const sMeta = store ? storeStatusMeta(store.status) : null;
  const firstName = retailer.legalName.split(' ')[0] ?? retailer.legalName;
  const liveAndKicking = retailer.status === 'active' && store?.status === 'active';

  const steps: Step[] = [
    { id: 1, kicker: 'You', title: 'Account & GSTIN submitted', body: 'KYC auto-verified at signup.', done: true },
    {
      id: 2,
      kicker: 'Admin',
      title: 'Account approved',
      body: rMeta.label + (retailer.status === 'pending_approval' ? ' — admin will review shortly.' : ''),
      done: retailer.status === 'active',
      pending: retailer.status === 'pending_approval',
    },
    {
      id: 3,
      kicker: 'You',
      title: 'Storefront submitted',
      body: store ? store.legalName : 'Not yet submitted.',
      done: Boolean(store),
      cta: store ? null : { label: 'Submit storefront', to: '/retailer/store' },
    },
    {
      id: 4,
      kicker: 'Admin',
      title: 'Storefront approved',
      body: sMeta?.label ?? 'Awaiting',
      done: store?.status === 'active',
      pending: store?.status === 'onboarding',
    },
    {
      id: 5,
      kicker: 'You',
      title: 'Add your first product',
      body: liveAndKicking
        ? 'Your store is live. Time to publish.'
        : 'Available once both you and your store are approved.',
      done: false,
      cta: liveAndKicking ? { label: 'Add product', to: '/retailer/listings' } : null,
    },
  ];

  return (
    <Page>
      <PageHeader
        title={
          <>
            Welcome back, <em>{firstName}</em>
          </>
        }
        description={
          <>
            Your account and store status at a glance, plus the steps left before
            customers can shop your products.
          </>
        }
        actions={
          liveAndKicking ? (
            <Button asChild variant="ink" caps iconLeft={<Plus className="size-3.5" />}>
              <Link to="/retailer/listings">New product</Link>
            </Button>
          ) : undefined
        }
      />

      {/* Status snapshots in a hairline-divided 3-column row */}
      <div className="mb-12 grid grid-cols-1 divide-y divide-rule border-y border-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Snapshot
          kicker="Account"
          headline={rMeta.label}
          tone={rMeta.tone === 'success' ? 'good' : rMeta.tone === 'warning' ? 'wait' : 'bad'}
          meta={[retailer.email, retailer.phone, retailer.gstin]}
          mono={[2]}
        />
        <Snapshot
          kicker="Storefront"
          headline={sMeta?.label ?? 'Not on file'}
          tone={
            sMeta?.tone === 'success'
              ? 'good'
              : sMeta?.tone === 'info' || sMeta?.tone === 'warning'
                ? 'wait'
                : sMeta
                  ? 'bad'
                  : 'neutral'
          }
          meta={
            store
              ? [store.legalName, store.address]
              : ['No store yet — submit one to begin.']
          }
          cta={
            !store
              ? { label: 'Submit storefront', to: '/retailer/store' }
              : store.status === 'active'
                ? { label: 'View storefront', to: '/retailer/store' }
                : { label: 'Open storefront', to: '/retailer/store' }
          }
        />
        <Snapshot
          kicker="Products"
          headline={liveAndKicking ? 'Open for publishing' : 'Closed'}
          tone={liveAndKicking ? 'good' : 'wait'}
          meta={
            liveAndKicking
              ? ['Both your account and store are approved.', 'Add products and manage stock.']
              : ['Available once both account and store are approved.']
          }
          cta={
            liveAndKicking
              ? { label: 'Open products', to: '/retailer/listings' }
              : undefined
          }
        />
      </div>

      <SectionHeading
        title="Onboarding checklist"
        hint={`${steps.filter((s) => s.done).length} of ${steps.length} cleared`}
      />

      <ol className="space-y-px" data-stagger>
        {isLoading
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)
          : steps.map((s) => <StepRow key={s.id} step={s} />)}
      </ol>
    </Page>
  );
}

type Tone = 'good' | 'wait' | 'bad' | 'neutral';

function Snapshot({
  kicker,
  headline,
  tone,
  meta,
  mono,
  cta,
}: {
  kicker: string;
  headline: string;
  tone: Tone;
  meta: string[];
  mono?: number[] | undefined;
  cta?: { label: string; to: string } | undefined;
}) {
  const dot =
    tone === 'good'
      ? 'bg-success'
      : tone === 'wait'
        ? 'bg-warning'
        : tone === 'bad'
          ? 'bg-danger'
          : 'bg-ink-3';
  return (
    <div className="px-6 py-7">
      <div className="kicker text-ink-3 mb-3 flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
        {kicker}
      </div>
      <div className="font-display italic text-[28px] leading-tight text-ink">{headline}</div>
      <ul className="mt-4 space-y-1.5 text-[13.5px] text-ink-2">
        {meta.map((m, i) => (
          <li key={i} className={mono?.includes(i) ? 'font-mono text-[12.5px]' : ''}>
            {m}
          </li>
        ))}
      </ul>
      {cta && (
        <Link
          to={cta.to}
          className="mt-4 inline-flex items-center gap-1 text-[12px] uppercase tracking-[0.16em] text-ink hover:underline underline-offset-4"
        >
          {cta.label} <ArrowUpRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

type Step = {
  id: number;
  kicker: string;
  title: string;
  body: string;
  done: boolean;
  pending?: boolean;
  cta?: { label: string; to: string } | null;
};

function StepRow({ step }: { step: Step }) {
  return (
    <li className="grid grid-cols-12 items-baseline gap-4 border-b border-rule py-5 last:border-b-0">
      <div className="col-span-2 sm:col-span-1">
        <span className="font-mono text-[11px] tracking-wider text-ink-3">
          № {String(step.id).padStart(2, '0')}
        </span>
      </div>
      <div className="col-span-1 sm:col-span-1">
        {step.done ? (
          <CheckCircle2 className="size-5 text-success" />
        ) : step.pending ? (
          <Clock className="size-5 text-warning" />
        ) : (
          <span className="size-5 inline-block border border-rule-strong rounded-full" />
        )}
      </div>
      <div className="col-span-9 sm:col-span-7">
        <div className="kicker text-ink-3">{step.kicker}</div>
        <div className="mt-1 font-display italic text-[20px] leading-tight">{step.title}</div>
        <p className="mt-1.5 text-[13.5px] text-ink-2">{step.body}</p>
      </div>
      <div className="col-span-12 sm:col-span-3 flex items-center sm:justify-end">
        {step.cta && (
          <Button asChild variant="outline" size="sm" caps iconRight={<ArrowUpRight className="size-3.5" />}>
            <Link to={step.cta.to}>{step.cta.label}</Link>
          </Button>
        )}
        {!step.cta && step.pending && <Badge tone="warning">Awaiting</Badge>}
      </div>
    </li>
  );
}
