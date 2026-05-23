import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BulkAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
}

/**
 * Sticky bottom-of-screen bar for admin bulk actions. Hidden when
 * `selectedCount === 0`. Mirrors retailer-side bulk pattern.
 */
export function BulkActionBar({ selectedCount, actions, onClear }: BulkActionBarProps) {
  if (selectedCount === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center">
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-line bg-bg/95 px-3 py-2 shadow-lg backdrop-blur">
        <span className="px-2 text-[12.5px] font-medium text-ink">
          {selectedCount} selected
        </span>
        <span className="h-5 w-px bg-line" />
        {actions.map((a) => (
          <Button
            key={a.label}
            size="sm"
            variant={a.danger ? 'outline' : 'ink'}
            className={a.danger ? 'text-danger border-danger/40 hover:bg-danger/5' : undefined}
            onClick={a.onClick}
            {...(a.loading !== undefined ? { loading: a.loading } : {})}
            {...(a.disabled !== undefined ? { disabled: a.disabled } : {})}
          >
            {a.label}
          </Button>
        ))}
        <span className="h-5 w-px bg-line" />
        <Button size="sm" variant="ghost" iconLeft={<X className="size-3.5" />} onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
