import { cn } from '@/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type HoursConfig = {
  days: DayKey[];
  open: string;
  close: string;
};

export const DEFAULT_HOURS: HoursConfig = {
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  open: '10:00',
  close: '21:00',
};

const DAY_LABELS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const period = h < 12 ? 'AM' : 'PM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${h12}:${String(m).padStart(2, '0')} ${period}`;
      opts.push({ value, label });
    }
  }
  return opts;
})();

export function hoursConfigToRecord(cfg: HoursConfig): Record<string, { from: string; to: string; closed: boolean }> {
  const all: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  return Object.fromEntries(
    all.map((d) => [d, cfg.days.includes(d)
      ? { from: cfg.open, to: cfg.close, closed: false }
      : { from: '00:00', to: '00:00', closed: true }
    ])
  );
}

interface StoreHoursPickerProps {
  value: HoursConfig;
  onChange: (v: HoursConfig) => void;
}

export function StoreHoursPicker({ value, onChange }: StoreHoursPickerProps) {
  function toggleDay(d: DayKey) {
    const days = value.days.includes(d)
      ? value.days.filter((x) => x !== d)
      : [...value.days, d];
    onChange({ ...value, days });
  }

  return (
    <div className="rounded-lg border border-line-2 bg-bg overflow-hidden">
      {/* Day chips */}
      <div className="flex gap-1.5 px-3 py-3 flex-wrap">
        {DAY_LABELS.map(({ key, label }) => {
          const active = value.days.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleDay(key)}
              className={cn(
                'h-8 min-w-[2.75rem] rounded-md px-3 text-[12.5px] font-medium transition-all select-none',
                active
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-bg-2 text-ink-3 hover:bg-bg-3 hover:text-ink',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Time range */}
      <div className="border-t border-line-2 bg-bg-2/40 px-3 py-2.5 flex items-center gap-2">
        <span className="text-[12px] text-ink-3 w-10 shrink-0">Open</span>
        <Select value={value.open} onValueChange={(v) => onChange({ ...value, open: v })}>
          <SelectTrigger className="w-[110px] h-8 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-[12px] text-ink-3 px-1">→</span>

        <span className="text-[12px] text-ink-3 w-10 shrink-0">Close</span>
        <Select value={value.close} onValueChange={(v) => onChange({ ...value, close: v })}>
          <SelectTrigger className="w-[110px] h-8 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {value.days.length > 0 && (
          <span className="ml-auto text-[11.5px] text-ink-3 font-mono">
            {value.days.length === 7 ? 'Mon–Sun' : value.days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')} · {value.open}–{value.close}
          </span>
        )}
      </div>

      {value.days.length === 0 && (
        <div className="border-t border-line-2 px-3 py-2 text-[12px] text-ink-3 italic">
          No days selected — store will appear as closed.
        </div>
      )}
    </div>
  );
}
