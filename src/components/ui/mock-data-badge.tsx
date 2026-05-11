import { TestTube2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type MockDataBadgeProps = {
  label?: string;
  className?: string;
};

/**
 * Yellow chip dropped into a Card or PageHeader action slot to mark surfaces
 * served by `mockFetch`. The label should call out the doc section so anyone
 * grepping for "MOCKED" can correlate to the realignment plan.
 */
export function MockDataBadge({ label = 'MOCKED', className }: MockDataBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft ' +
          'px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap text-warning',
        className,
      )}
      title="This data is served by a mock fixture and will be replaced when the backend lands."
    >
      <TestTube2 className="size-3" aria-hidden />
      {label}
    </span>
  );
}
