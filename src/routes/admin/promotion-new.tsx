import { Link, useNavigate } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Mechanism, Promotion } from '@/lib/types';
import { DiscountConfigForm } from '@/components/promotion/DiscountConfigForm';

type FormValues = {
  name: string;
  mechanism: Mechanism;
  discountType: string;
  storeId?: string;
  config: Record<string, unknown>;
  validFrom: string;
  validUntil: string;
  totalUses?: number | null;
  perConsumerLimit?: number | null;
  status: 'draft' | 'scheduled' | 'active';
  notes?: string;
};

export default function AdminPromotionNew() {
  const navigate = useNavigate();
  const form = useForm<FormValues>({
    defaultValues: {
      name: '',
      mechanism: 'coupon',
      discountType: 'percent',
      storeId: '',
      config: { percent: 10 },
      validFrom: new Date().toISOString().slice(0, 16),
      validUntil: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 16),
      totalUses: null,
      perConsumerLimit: 1,
      status: 'draft',
    },
  });

  const create = useMutation({
    mutationFn: (v: FormValues) => {
      const payload: Record<string, unknown> = {
        name: v.name,
        mechanism: v.mechanism,
        discountType: v.discountType,
        config: v.config,
        validFrom: new Date(v.validFrom).toISOString(),
        validUntil: new Date(v.validUntil).toISOString(),
        status: v.status,
      };
      if (v.storeId) payload.storeId = v.storeId;
      if (v.totalUses != null) payload.totalUses = v.totalUses;
      if (v.perConsumerLimit != null) payload.perConsumerLimit = v.perConsumerLimit;
      return api<Promotion>('/admin/promotions', { method: 'POST', body: payload });
    },
    onSuccess: (p) => {
      toast.success(`Created · ${p.name}`);
      navigate(`/admin/promotions/${p.id}`);
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Could not create';
      toast.error(msg);
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = form;

  return (
    <Page>
      <Link
        to="/admin/promotions"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.16em] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All promotions
      </Link>
      <PageHeader
        title={<>New <em>promotion</em></>}
        description="Define one offer, coupon, or voucher. You can edit, pause, or revoke it later."
      />

      <FormProvider {...form}>
        <form
          onSubmit={handleSubmit((v) => create.mutate(v))}
          className="grid gap-12 lg:grid-cols-12"
          noValidate
        >
          <section className="lg:col-span-7 space-y-7">
            <SectionHeading title="Basics" />
            <div>
              <Label required hint="Coupon code goes in here too — same field">Name</Label>
              <Input placeholder="e.g. WELCOME50" {...register('name', { required: 'Required' })} />
              <FieldError>{errors.name?.message}</FieldError>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <Label required>Mechanism</Label>
                <Select value={watch('mechanism')} onValueChange={(v) => setValue('mechanism', v as Mechanism)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offer">Offer (auto)</SelectItem>
                    <SelectItem value="coupon">Coupon (code)</SelectItem>
                    <SelectItem value="voucher">Voucher (single-use)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label hint="Optional — store-scoped">Store ID</Label>
                <Input mono placeholder="Leave blank for platform-wide" {...register('storeId')} />
              </div>
              <div>
                <Label required>Initial status</Label>
                <Select value={watch('status')} onValueChange={(v) => setValue('status', v as 'draft' | 'scheduled' | 'active')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <SectionHeading title="Discount" />
            <DiscountConfigForm />

            <SectionHeading title="Validity & caps" />
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label required>Valid from</Label>
                <Input type="datetime-local" {...register('validFrom', { required: 'Required' })} />
              </div>
              <div>
                <Label required>Valid until</Label>
                <Input type="datetime-local" {...register('validUntil', { required: 'Required' })} />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label hint="Leave blank for unlimited">Total redemptions</Label>
                <Input
                  mono
                  type="number"
                  min={0}
                  placeholder="∞"
                  {...register('totalUses', { setValueAs: nullableInt })}
                />
              </div>
              <div>
                <Label hint="Per consumer; leave blank for unlimited">Per-consumer limit</Label>
                <Input
                  mono
                  type="number"
                  min={0}
                  placeholder="∞"
                  {...register('perConsumerLimit', { setValueAs: nullableInt })}
                />
              </div>
            </div>
          </section>

          <aside className="lg:col-span-5 space-y-7">
            <div className="border border-ink bg-surface p-5">
              <div className="kicker text-ink-3 mb-2">Notes</div>
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                Offers apply automatically when their conditions match. Coupons require the
                consumer to type a code (use the <em>name</em> field as the code). Vouchers
                require an additional bulk-generation step after creation — visit the
                promotion's detail page to issue codes.
              </p>
              <Textarea
                rows={3}
                className="mt-4"
                placeholder="Internal notes (not stored — for now)"
                {...register('notes')}
              />
            </div>
          </aside>

          <div className="lg:col-span-12 flex items-center justify-end gap-3 border-t border-rule pt-6">
            <Button asChild variant="ghost"><Link to="/admin/promotions">Cancel</Link></Button>
            <Button type="submit" variant="ink" caps loading={isSubmitting || create.isPending}>
              Create promotion
            </Button>
          </div>
        </form>
      </FormProvider>
    </Page>
  );
}

function nullableInt(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
