import { Clock } from 'lucide-react';
import { cn } from '@/lib/cn';

type FreshnessLabelProps = {
  generatedAtIst?: string | null | undefined;
  className?: string;
};

export function FreshnessLabel({ generatedAtIst, className }: FreshnessLabelProps) {
  if (!generatedAtIst) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] text-ink-4 font-mono',
        className,
      )}
      title="Time the report aggregation was generated (IST)"
    >
      <Clock className="size-3" />
      as of {generatedAtIst}
    </span>
  );
}
