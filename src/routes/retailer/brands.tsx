import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Brand } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';

const Schema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase, hyphenated'),
  name: z.string().trim().min(1).max(120),
  tintColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Hex like #ff6600')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});
type FormValues = z.infer<typeof Schema>;

export default function RetailerBrands() {
  const [open, setOpen] = useState(false);
  const brands = useQuery({ queryKey: ['catalog', 'brands'], queryFn: () => api<Brand[]>('/catalog/brands') });

  return (
    <Page>
      <PageHeader
        title={<>Brands</>}
        description={
          <>
            Brands attached to your products. Pick from the seeded defaults or register
            your own — slug must be lowercase and hyphenated.
          </>
        }
        actions={
          <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
            New brand
          </Button>
        }
      />

      {brands.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-stagger>
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : brands.isError ? (
        <Empty kicker="Connection lost" title="Couldn't load brands." />
      ) : (brands.data ?? []).length === 0 ? (
        <Empty kicker="Empty" title="No brands yet." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-stagger>
          {(brands.data ?? []).map((b, i) => (
            <li key={b.id} className="border border-rule bg-surface p-5 hover:border-ink transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="font-mono text-[11px] tracking-wider text-ink-3">
                  № {String(i + 1).padStart(3, '0')}
                </div>
                {!b.isActive && <div className="kicker text-ink-3">— Inactive —</div>}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className="grid size-12 place-items-center border border-rule font-display italic text-[20px] text-ink"
                  style={{ backgroundColor: b.tintColor ?? 'var(--color-paper-2)' }}
                >
                  {b.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="font-display italic text-[22px] leading-tight truncate">{b.name}</div>
                  <div className="kicker text-ink-3 truncate">{b.slug}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateDialog open={open} onOpenChange={setOpen} />
    </Page>
  );
}

function CreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(Schema),
    defaultValues: { slug: '', name: '', tintColor: '' },
  });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      api<Brand>('/retailer/brands', {
        method: 'POST',
        body: { slug: v.slug, name: v.name, ...(v.tintColor ? { tintColor: v.tintColor } : {}) },
      }),
    onSuccess: (b) => {
      toast.success(`Created brand · ${b.name}`);
      onOpenChange(false);
      reset();
      void qc.invalidateQueries({ queryKey: ['catalog', 'brands'] });
    },
    onError: (e) => {
      toast.error(
        e instanceof ApiError && e.code === 'invalid_state'
          ? 'That slug is already taken.'
          : e instanceof Error
            ? e.message
            : 'Could not register brand',
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a brand</DialogTitle>
          <DialogDescription>Slug is the URL identifier; name is what customers see.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-5" noValidate>
          <div>
            <Label htmlFor="bSlug" required hint="lowercase, hyphenated">Slug</Label>
            <Input id="bSlug" mono placeholder="e.g. acme" {...register('slug')} />
            <FieldError>{errors.slug?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="bName" required>Name</Label>
            <Input id="bName" placeholder="e.g. Acme Apparel" {...register('name')} />
            <FieldError>{errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="bTint" hint="Optional">Tint</Label>
            <Input id="bTint" mono placeholder="e.g. #FF6600" {...register('tintColor')} />
            <FieldError>{errors.tintColor?.message}</FieldError>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={isSubmitting || create.isPending}>Register</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
