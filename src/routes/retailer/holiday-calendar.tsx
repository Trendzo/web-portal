import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { HolidayDate } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';

const QK = ['retailer', 'holiday-calendar'];

export default function RetailerHolidayCalendar() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: () =>
      api<{ date: string; reason: string | null }[]>('/retailer/store/holiday-closures').then((rows) =>
        rows.map((r) => ({ date: r.date, label: r.reason ?? null }) satisfies HolidayDate),
      ),
  });
  const list = data ?? [];
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [view, setView] = useState<'upcoming' | 'all'>('upcoming');

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const upcoming = list.filter((h) => h.date >= today && h.date <= in30);
  const past = list.filter((h) => h.date < today);
  const future = list.filter((h) => h.date > in30);
  const displayList = view === 'upcoming' ? upcoming : [...future, ...upcoming].sort((a, b) => a.date.localeCompare(b.date));

  const add = useMutation({
    mutationFn: (h: HolidayDate) =>
      api('/retailer/store/holiday-closures', {
        method: 'POST',
        body: { date: h.date, reason: h.label ?? undefined },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK });
      toast.success('Holiday added');
      setDate('');
      setLabel('');
    },
    onError: () => toast.error('Failed to add holiday'),
  });
  const remove = useMutation({
    mutationFn: (target: string) =>
      api(`/retailer/store/holiday-closures/${target}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK }),
    onError: () => toast.error('Failed to remove holiday'),
  });

  return (
    <Page>
      <PageHeader
        kicker="Store Operations"
        title="Holiday calendar"
        description="Mark closed dates so the store hours engine blocks new orders for delivery on those days."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Add" title="New closed date" />
            <div className="space-y-3">
              <div>
                <Label htmlFor="hol-date" required>Date</Label>
                <Input id="hol-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="hol-label">Label (optional)</Label>
                <Input id="hol-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Diwali — closed all day" />
              </div>
              <Button
                variant="accent"
                iconLeft={<CalendarPlus className="size-3.5" />}
                disabled={!date || list.some((h) => h.date === date)}
                loading={add.isPending}
                onClick={() => add.mutate({ date, label: label.trim() || null })}
              >
                Add holiday
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <SectionHeading kicker={view === 'upcoming' ? 'Next 30 days' : 'All upcoming'} title={`${displayList.length} closed date${displayList.length === 1 ? '' : 's'}`} />
              <div className="flex gap-1">
                {(['upcoming', 'all'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={
                      'rounded-full border px-3 py-1 text-[12px] capitalize transition-colors ' +
                      (view === v ? 'border-ink bg-ink text-bg' : 'border-line bg-bg text-ink-2 hover:border-line-2')
                    }
                  >
                    {v === 'upcoming' ? 'Next 30 days' : 'All'}
                  </button>
                ))}
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : displayList.length === 0 ? (
              <Empty kicker="Empty" title={view === 'upcoming' ? 'No closures in the next 30 days.' : 'No closed dates marked.'} />
            ) : (
              <ul className="space-y-2">
                {displayList.map((h) => (
                  <li key={h.date} className="flex items-center justify-between rounded-md border border-line bg-bg-2/30 px-3 py-2">
                    <div>
                      <div className="text-[13.5px] font-medium text-ink">
                        {new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {h.label && <div className="text-[12px] text-ink-3">{h.label}</div>}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={<Trash2 className="size-3.5" />}
                      onClick={() => remove.mutate(h.date)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {view === 'all' && past.length > 0 && (
              <div className="mt-6">
                <div className="text-[12px] text-ink-3 font-medium mb-2">Past dates</div>
                <ul className="space-y-1 opacity-60">
                  {[...past].sort((a, b) => b.date.localeCompare(a.date)).map((h) => (
                    <li key={h.date} className="flex items-center justify-between rounded-md border border-line bg-bg-2/20 px-3 py-2">
                      <div>
                        <div className="text-[13px] text-ink-2">
                          {new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        {h.label && <div className="text-[11.5px] text-ink-3">{h.label}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
