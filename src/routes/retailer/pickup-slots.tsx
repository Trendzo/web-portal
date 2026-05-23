import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Slot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
  isActive: boolean;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RetailerPickupSlots() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'pickup-slots'],
    queryFn: () => api<Slot[]>('/retailer/store/pickup-slots'),
  });
  const slots = data ?? [];

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/retailer/store/pickup-slots/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Slot removed');
      void qc.invalidateQueries({ queryKey: ['retailer', 'pickup-slots'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Remove failed'),
  });

  return (
    <Page>
      <PageHeader
        kicker="Store"
        title="Pickup slots"
        description="Day-of-week windows shoppers can pick to collect orders in person. Capacity caps how many bookings land in a slot."
        actions={
          <Button variant="ink" size="sm" iconLeft={<Plus className="size-3.5" />} onClick={() => setAddOpen(true)}>
            New slot
          </Button>
        }
      />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : slots.length === 0 ? (
        <Card><CardContent className="p-6"><p className="text-[13px] text-ink-3 italic">No slots yet.</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-2/40 border-b border-line">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3">Day</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3">Window</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-3">Capacity</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-3">Active</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {slots.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">{DAY_LABELS[s.dayOfWeek]}</td>
                    <td className="px-4 py-3 font-mono">{s.startTime} – {s.endTime}</td>
                    <td className="px-4 py-3 text-right font-mono">{s.capacity}</td>
                    <td className="px-4 py-3 text-right">{s.isActive ? 'yes' : 'no'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-danger border-danger/40"
                        iconLeft={<Trash2 className="size-3.5" />}
                        onClick={() => remove.mutate(s.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <AddSlotDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false);
          void qc.invalidateQueries({ queryKey: ['retailer', 'pickup-slots'] });
        }}
      />
    </Page>
  );
}

function AddSlotDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('18:00');
  const [capacity, setCapacity] = useState('5');

  const create = useMutation({
    mutationFn: () =>
      api('/retailer/store/pickup-slots', {
        method: 'POST',
        body: {
          dayOfWeek: parseInt(dayOfWeek, 10),
          startTime,
          endTime,
          capacity: parseInt(capacity, 10) || 1,
        },
      }),
    onSuccess: () => {
      toast.success('Slot created');
      onAdded();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Create failed'),
  });

  const timeValid = /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime);
  const capValid = (parseInt(capacity, 10) || 0) >= 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New pickup slot</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="dow" required>Day of week</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger id="dow"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_LABELS.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="st" required>Start (HH:MM)</Label>
              <Input id="st" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="et" required>End (HH:MM)</Label>
              <Input id="et" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <FieldError>{!timeValid ? 'Use HH:MM format' : ''}</FieldError>
          <div>
            <Label htmlFor="cap" required>Capacity</Label>
            <Input id="cap" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            <FieldError>{!capValid ? 'Min 1' : ''}</FieldError>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="ink" disabled={!timeValid || !capValid} loading={create.isPending} onClick={() => create.mutate()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
