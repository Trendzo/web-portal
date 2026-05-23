import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type {
  DashboardTileKey,
  NotificationChannel,
  NotificationPrefs,
} from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CHANNELS: Array<{ key: NotificationChannel; label: string; hint: string }> = [
  { key: 'in_app', label: 'In-app', hint: 'Bell + inbox in this dashboard' },
  { key: 'push', label: 'Push', hint: 'Browser/mobile push notifications' },
  { key: 'email', label: 'Email', hint: 'Sent to the owner email' },
  { key: 'sms', label: 'SMS', hint: 'Charged at carrier rates' },
];

const TILES: Array<{ key: DashboardTileKey; label: string }> = [
  { key: 'sales', label: 'Sales chart' },
  { key: 'orders', label: 'Orders snapshot' },
  { key: 'inventory', label: 'Inventory health' },
  { key: 'top_products', label: 'Top products' },
  { key: 'recent_products', label: 'Recent products' },
  { key: 'compliance', label: 'Compliance reminders' },
];

const QK = ['retailer', 'notification-prefs'];

export default function RetailerNotificationPrefs() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: async () => {
      const r = await api<{
        pushEnabled?: boolean; emailEnabled?: boolean; smsEnabled?: boolean;
        dailyDigestEnabled?: boolean; language?: NotificationPrefs['language'];
        dashboardTiles?: DashboardTileKey[];
      } | null>('/retailer/notification-prefs');
      return {
        channels: { push: r?.pushEnabled ?? true, email: r?.emailEnabled ?? true, sms: r?.smsEnabled ?? false, in_app: true },
        dailyDigest: r?.dailyDigestEnabled ?? false,
        language: r?.language ?? 'en',
        enabledDashboardTiles: r?.dashboardTiles ?? ['sales', 'orders', 'inventory', 'top_products'],
      } satisfies NotificationPrefs;
    },
  });
  const [draft, setDraft] = useState<NotificationPrefs | null>(null);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (next: NotificationPrefs) =>
      api('/retailer/notification-prefs', {
        method: 'PUT',
        body: {
          pushEnabled: next.channels.push,
          emailEnabled: next.channels.email,
          smsEnabled: next.channels.sms,
          dailyDigestEnabled: next.dailyDigest,
          language: next.language,
          dashboardTiles: next.enabledDashboardTiles,
        },
      }),
    onSuccess: () => {
      qc.setQueryData(QK, draft);
      toast.success('Preferences saved');
    },
  });

  if (isLoading || !draft) {
    return <Page><PageHeader title="Notification preferences" /><Skeleton className="h-72" /></Page>;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(data);
  const noExternalChannel = !draft.channels.push && !draft.channels.email && !draft.channels.sms;
  const noTiles = draft.enabledDashboardTiles.length === 0;
  const canSave = dirty && !noExternalChannel && !noTiles;

  function toggleChannel(c: NotificationChannel) {
    setDraft((d) => d && { ...d, channels: { ...d.channels, [c]: !d.channels[c] } });
  }
  function toggleTile(t: DashboardTileKey) {
    setDraft((d) => {
      if (!d) return d;
      const has = d.enabledDashboardTiles.includes(t);
      return {
        ...d,
        enabledDashboardTiles: has
          ? d.enabledDashboardTiles.filter((x) => x !== t)
          : [...d.enabledDashboardTiles, t],
      };
    });
  }

  return (
    <Page>
      <PageHeader
        kicker="Notifications"
        title="Notification preferences"
        description="Choose which channels deliver alerts, opt into the daily digest, set your language, and pick which dashboard tiles you see."
        actions={
          <Button variant="accent" disabled={!canSave} loading={save.isPending} onClick={() => save.mutate(draft)}>
            Save changes
          </Button>
        }
      />

      {noExternalChannel && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          At least one channel (Push, Email, or SMS) must stay enabled.
        </div>
      )}
      {noTiles && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          Select at least one dashboard tile.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Delivery" title="Channels" />
            <ul className="space-y-2">
              {CHANNELS.map((c) => (
                <li key={c.key} className="flex items-center justify-between rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
                  <div>
                    <div className="text-[13.5px] font-medium text-ink">{c.label}</div>
                    <div className="text-[11.5px] text-ink-3">{c.hint}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.channels[c.key]}
                    onChange={() => toggleChannel(c.key)}
                    className="size-4 cursor-pointer accent-accent"
                  />
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-center justify-between rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
              <div>
                <div className="text-[13.5px] font-medium text-ink">Daily digest</div>
                <div className="text-[11.5px] text-ink-3">A single morning email summarising the previous day.</div>
              </div>
              <input
                type="checkbox"
                checked={draft.dailyDigest}
                onChange={() => setDraft((d) => d && { ...d, dailyDigest: !d.dailyDigest })}
                className="size-4 cursor-pointer accent-accent"
              />
            </div>

            <div className="mt-6">
              <SectionHeading kicker="Language" title="Notification language" />
              <Select
                value={draft.language}
                onValueChange={(v) => setDraft((d) => d && { ...d, language: v as NotificationPrefs['language'] })}
              >
                <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">हिन्दी</SelectItem>
                  <SelectItem value="mr">मराठी</SelectItem>
                  <SelectItem value="ta">தமிழ்</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Dashboard" title="Visible tiles" />
            <p className="mb-3 text-[12.5px] text-ink-3">Untick any tile you don't want on the home dashboard.</p>
            <ul className="space-y-2">
              {TILES.map((t) => (
                <li key={t.key} className="flex items-center justify-between rounded-md border border-line bg-bg-2/30 px-3 py-2.5">
                  <span className="text-[13.5px] text-ink">{t.label}</span>
                  <input
                    type="checkbox"
                    checked={draft.enabledDashboardTiles.includes(t.key)}
                    onChange={() => toggleTile(t.key)}
                    className="size-4 cursor-pointer accent-accent"
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
