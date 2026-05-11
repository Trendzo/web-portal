import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import type { AiQuota } from '@/lib/types';

export function AiQuotaChip() {
  const { data } = useQuery({
    queryKey: ['retailer', 'ai-catalog', 'quota'],
    queryFn: () => api<AiQuota>('/retailer/ai-catalog/quota'),
  });
  if (!data) return null;
  const tone = data.remaining < 5 ? 'border-danger/40 text-danger' : data.remaining < 15 ? 'border-warning/40 text-warning' : 'border-bg/30 text-bg/80';
  const pct = Math.min(100, Math.round((data.used / data.total) * 100));
  return (
    <Link
      to="/retailer/ai-catalog"
      className={`block rounded-lg border bg-bg/5 px-3 py-2 ${tone} hover:bg-bg/10 transition-colors`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
        <Sparkles className="size-3" />
        AI quota
      </div>
      <div className="mt-1 text-[12.5px] text-bg/90">
        {data.used} / {data.total} used
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg/10">
        <div className="h-full bg-bg/70 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}
