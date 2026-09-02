import { AA_TEXT, contrastRatio } from '@/lib/contrast';
import { Badge } from '@/components/ui/badge';

/**
 * Live WCAG contrast chip for a fg/bg colour pair. Renders nothing until both
 * colours parse as #RRGGBB — half-filled forms stay quiet. Uses the same math as
 * the server's publish gate, so a red chip here means the publish WILL be blocked.
 */
export function ContrastCheck({
  fg,
  bg,
  label,
  threshold = AA_TEXT,
}: {
  fg?: string | undefined;
  bg?: string | undefined;
  label: string;
  threshold?: number | undefined;
}) {
  if (!fg || !bg) return null;
  const ratio = contrastRatio(fg, bg);
  if (ratio === null) return null;

  const passes = ratio >= threshold;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      <span className="flex items-center -space-x-1" aria-hidden>
        <span className="size-4 rounded-xs border border-ink/20" style={{ background: bg }} />
        <span className="size-4 rounded-xs border border-ink/20" style={{ background: fg }} />
      </span>
      <span className="text-ink-3">{label}</span>
      <span className="font-mono tabular-nums text-ink-2">{ratio.toFixed(1)}:1</span>
      {passes ? (
        <Badge tone="success" flat>
          AA pass
        </Badge>
      ) : (
        <Badge tone="danger" flat>
          fails {threshold}:1 — publish will be blocked
        </Badge>
      )}
    </div>
  );
}
