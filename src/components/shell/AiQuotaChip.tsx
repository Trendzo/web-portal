import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

/**
 * Sidebar chip linking to the AI catalog hub. Quota is per-listing now (one
 * generation per variant), so there's no global "X of 50 used" pill here — the
 * count lives on each listing's detail page.
 */
export function AiQuotaChip() {
  return (
    <Link
      to="/retailer/ai-catalog"
      className="block rounded-lg border border-bg/30 bg-bg/5 px-3 py-2 text-bg/80 hover:bg-bg/10 transition-colors"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
        <Sparkles className="size-3" />
        AI catalog
      </div>
      <div className="mt-1 text-[12.5px] text-bg/90">1 generation per variant</div>
    </Link>
  );
}
