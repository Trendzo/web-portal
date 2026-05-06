import { cn } from '@/lib/cn';

type AvatarProps = {
  /** Display name used to derive initials when no image is set. */
  name: string;
  /** Optional image URL — falls back to initials on error. */
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/**
 * Initials avatar — derived from the first two name parts. Stable per name so
 * the colour never flickers between renders. We use a small monochrome palette
 * keyed off character code to keep things calm in the masthead.
 */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = pickInitials(name);
  const sizeClass = size === 'sm' ? 'size-7 text-[11px]' : size === 'lg' ? 'size-10 text-[14px]' : 'size-8 text-[12px]';
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-medium text-ink overflow-hidden',
        'bg-bg-3 border border-line',
        sizeClass,
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="leading-none">{initials}</span>
      )}
    </span>
  );
}

function pickInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '·';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}
