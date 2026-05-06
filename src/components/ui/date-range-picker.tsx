import { useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import 'react-day-picker/style.css';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type DateRangeValue = {
  from: Date | null;
  to: Date | null;
};

type Props = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  /** Show the time-of-day inputs below the calendar. Defaults to true. */
  withTime?: boolean;
  /** Trigger button label override; defaults to "Pick dates". */
  placeholder?: string;
  /** Disable the picker entirely. */
  disabled?: boolean;
};

/**
 * Range-mode calendar with optional time-of-day refinement, anchored in a popover.
 *
 * The component is fully controlled — the parent owns the canonical `{from, to}` and
 * we surface a typed `onChange`. Internally we keep a draft so the user can adjust
 * dates and times together before committing on "Done"; this avoids a flicker of
 * intermediate states bubbling up to forms that auto-save on every change.
 */
export function DateRangePicker({
  value,
  onChange,
  withTime = true,
  placeholder = 'Pick dates',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRangeValue>(value);

  // Re-sync draft from props when the popover opens (reflects an external clear /
  // form reset). While open, we let the user freely edit without props clobbering.
  function handleOpenChange(next: boolean) {
    if (next) setDraft(value);
    setOpen(next);
  }

  function commit(next: DateRangeValue) {
    onChange(next);
    setOpen(false);
  }

  function handleSelectRange(range: DateRange | undefined) {
    if (!range) {
      setDraft({ from: null, to: null });
      return;
    }
    // react-day-picker hands back undefined for unselected end; map to null and
    // preserve the time-of-day from the existing draft for each endpoint.
    setDraft({
      from: range.from ? mergeTime(range.from, draft.from) : null,
      to: range.to ? mergeTime(range.to, draft.to) : null,
    });
  }

  function handleTimeChange(which: 'from' | 'to', timeStr: string) {
    const base = draft[which];
    if (!base || !timeStr) return;
    const parts = timeStr.split(':').map((n) => parseInt(n, 10));
    const h = parts[0];
    const m = parts[1];
    if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return;
    const next = new Date(base);
    next.setHours(h, m, 0, 0);
    setDraft({ ...draft, [which]: next });
  }

  const triggerLabel = formatRange(value);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-xs border border-rule bg-surface px-3 py-2',
            'text-left text-[13.5px] hover:border-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink',
            'disabled:cursor-not-allowed disabled:opacity-50',
            value.from || value.to ? 'text-ink' : 'text-ink-3',
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <Calendar className="size-4 text-ink-3" />
            {triggerLabel ?? placeholder}
          </span>
          {(value.from || value.to) && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear dates"
              className="grid size-5 place-items-center text-ink-3 hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ from: null, to: null });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange({ from: null, to: null });
                }
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <div className="px-4 pt-4">
          <DayPicker
            mode="range"
            numberOfMonths={2}
            selected={
              draft.from || draft.to
                ? { from: draft.from ?? undefined, to: draft.to ?? undefined }
                : undefined
            }
            onSelect={handleSelectRange}
            showOutsideDays
            classNames={atelierClassNames}
            components={{
              Chevron: ({ orientation }) =>
                orientation === 'left' ? (
                  <ChevronLeft className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                ),
            }}
          />
        </div>

        {withTime && (
          <div className="grid grid-cols-2 gap-3 border-t border-rule px-4 py-3">
            <TimeField
              label="Starts"
              date={draft.from}
              onChange={(t) => handleTimeChange('from', t)}
            />
            <TimeField
              label="Ends"
              date={draft.to}
              onChange={(t) => handleTimeChange('to', t)}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-rule px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => commit({ from: null, to: null })}
          >
            Clear
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="ink"
              size="sm"
              caps
              onClick={() => commit(draft)}
              disabled={!draft.from && !draft.to}
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimeField({
  label,
  date,
  onChange,
}: {
  label: string;
  date: Date | null;
  onChange: (timeStr: string) => void;
}) {
  const value = date ? format(date, 'HH:mm') : '';
  return (
    <label className="flex flex-col gap-1">
      <span className="kicker text-ink-3">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!date}
        className={cn(
          'rounded-xs border border-rule bg-surface px-2 py-1.5 font-mono text-[13px]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />
    </label>
  );
}

function formatRange(v: DateRangeValue): string | null {
  if (!v.from && !v.to) return null;
  const fmt = (d: Date | null) => (d ? format(d, "MMM d, yyyy · h:mm aaa") : '—');
  return `${fmt(v.from)}  →  ${fmt(v.to)}`;
}

/** Carry over the time-of-day from `previous` onto `next` when picking a new date. */
function mergeTime(next: Date, previous: Date | null): Date {
  const out = new Date(next);
  if (previous) {
    out.setHours(previous.getHours(), previous.getMinutes(), 0, 0);
  } else {
    out.setHours(0, 0, 0, 0);
  }
  return out;
}

// react-day-picker v9 className overrides — restyle the calendar to the Atelier
// palette without forking the layout. Keys come from rdp's `classNames` slot map.
const atelierClassNames: Partial<Record<string, string>> = {
  root: 'rdp-root text-ink',
  months: 'flex flex-col gap-6 sm:flex-row sm:gap-8',
  month: 'space-y-4',
  caption_label: 'font-display italic text-[18px] leading-tight px-2',
  nav: 'flex items-center gap-1',
  button_previous:
    'inline-grid size-7 place-items-center rounded-xs border border-rule text-ink-2 hover:border-ink hover:text-ink',
  button_next:
    'inline-grid size-7 place-items-center rounded-xs border border-rule text-ink-2 hover:border-ink hover:text-ink',
  month_grid: 'w-full border-collapse',
  weekdays: 'kicker text-ink-3',
  weekday: 'pb-2 text-center font-normal',
  day: 'p-0 text-center text-[13px]',
  day_button:
    'inline-grid size-9 place-items-center rounded-xs hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink',
  selected: '[&>button]:bg-ink [&>button]:text-paper [&>button]:hover:bg-ink',
  range_start: '[&>button]:rounded-l-xs [&>button]:rounded-r-none',
  range_end: '[&>button]:rounded-r-xs [&>button]:rounded-l-none',
  range_middle:
    '[&>button]:rounded-none [&>button]:bg-paper-2 [&>button]:text-ink [&>button]:hover:bg-paper-2',
  today: '[&>button]:font-semibold [&>button]:underline [&>button]:underline-offset-4',
  outside: 'text-ink-4',
  disabled: 'opacity-40 [&>button]:cursor-not-allowed',
};
