import { type ReactNode } from 'react';
import { ArrowRight, ShieldCheck, Store, Truck, User, Zap } from 'lucide-react';
import type { ActorType, OrderStatus, OrderTransition } from '@/lib/types';
import { actorLabel, formatAge, orderStatusMeta } from '@/lib/status';
import { cn } from '@/lib/cn';

const actorIcon: Record<ActorType, typeof ShieldCheck> = {
  consumer: User,
  retailer: Store,
  admin: ShieldCheck,
  delivery_agent: Truck,
  system: Zap,
};

/**
 * Vertical event timeline. Renders each transition with the from→to status pills,
 * actor icon, age, and optional reason. The most recent event is rendered first.
 *
 * Filters out marker rows where fromStatus === toStatus and renders them as an
 * info note ("retailer requested cancellation") rather than a state change.
 */
export function Timeline({
  transitions,
  emptyText = 'No events yet.',
}: {
  transitions: OrderTransition[];
  emptyText?: string;
}) {
  if (transitions.length === 0) {
    return <div className="text-[12.5px] text-ink-3 italic px-2 py-3">{emptyText}</div>;
  }
  // Render reverse-chronologically — newest first.
  const ordered = [...transitions].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return (
    <ol className="relative">
      {ordered.map((t, idx) => {
        const Icon = actorIcon[t.actorType];
        const isMarker = t.fromStatus === t.toStatus;
        const isFirst = idx === 0;
        const fromMeta = t.fromStatus ? orderStatusMeta(t.fromStatus as OrderStatus) : null;
        const toMeta = orderStatusMeta(t.toStatus as OrderStatus);
        return (
          <li key={t.id} className="relative pl-9 pb-4 last:pb-0">
            {/* Vertical connector */}
            {idx < ordered.length - 1 && (
              <span className="absolute left-3 top-6 bottom-0 w-px bg-line" aria-hidden />
            )}
            {/* Actor icon */}
            <span
              className={cn(
                'absolute left-0 top-0 grid size-6 place-items-center rounded-full border',
                isFirst ? 'bg-accent text-accent-fg border-accent' : 'bg-bg border-line text-ink-2',
              )}
            >
              <Icon className="size-3" />
            </span>
            {/* Content */}
            <div className="text-[13px]">
              {isMarker ? (
                <div className="text-ink-2">
                  <span className="font-medium">{actorLabel(t.actorType)}</span>{' '}
                  {t.reason ?? 'logged a marker'}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-ink">{actorLabel(t.actorType)}</span>
                  {fromMeta && (
                    <>
                      <Pill tone={fromMeta.tone}>{fromMeta.kicker}</Pill>
                      <ArrowRight className="size-3 text-ink-4" />
                    </>
                  )}
                  <Pill tone={toMeta.tone}>{toMeta.kicker}</Pill>
                </div>
              )}
              <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-3">
                <span>{formatAge(t.at)}</span>
                <span>·</span>
                <span>{new Date(t.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                {t.reason && !isMarker && (
                  <>
                    <span>·</span>
                    <span className="italic">{t.reason}</span>
                  </>
                )}
                {typeof t.metadata?.impersonatingAdminSessionId === 'string' && (
                  <span className="text-[10.5px] text-warning/70 italic">via admin impersonation</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Pill({ tone, children }: { tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  const cls =
    tone === 'success' ? 'bg-success-soft text-success border-success/20' :
    tone === 'warning' ? 'bg-warning-soft text-warning border-warning/20' :
    tone === 'danger'  ? 'bg-danger-soft text-danger border-danger/20'   :
    tone === 'info'    ? 'bg-info-soft text-info border-info/20'         :
                         'bg-bg-2 text-ink-2 border-line';
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-medium border', cls)}>
      {children}
    </span>
  );
}
