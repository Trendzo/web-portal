import { lazy, Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, MapPin } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { geocodeLocation } from '@/lib/geocode';
import { lookupPincode, type PincodeLookup } from '@/lib/pincode';
import { storeStatusMeta } from '@/lib/status';
import type { RetailerProfile, Store } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';

// Leaflet (~150 KB) + react-leaflet are heavy; lazy-load so they only enter the bundle
// when the user actually opens the picker.
const MapPicker = lazy(() => import('@/components/ui/map-picker'));

const Schema = z.object({
  legalName: z.string().trim().min(2).max(120),
  // Just the street/locality — city, state, country are auto-filled from the PIN code.
  address: z.string().trim().min(5).max(500),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit PIN code'),
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
  // Platform fee AND payout cadence are admin-controlled — set when admin approves
  // the store. The retailer form doesn't collect either.
});
type FormValues = z.infer<typeof Schema>;
type MeResponse = { retailer: RetailerProfile; store: Store | null };

export default function RetailerStorePage() {
  const qc = useQueryClient();
  const patchRetailer = useAuth((s) => s.patchRetailer);

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'me'],
    queryFn: () => api<MeResponse>('/retailer/me'),
  });

  if (isLoading) {
    return (
      <Page>
        <PageHeader title="Storefront" />
        <Skeleton className="h-72 w-full" />
      </Page>
    );
  }

  if (data?.store) return <StoreDetails store={data.store} />;

  return (
    <StoreCreateForm
      onCreated={(s) => {
        patchRetailer({ storeId: s.id });
        void qc.invalidateQueries({ queryKey: ['retailer', 'me'] });
      }}
    />
  );
}

function StoreDetails({ store }: { store: Store }) {
  const meta = storeStatusMeta(store.status);
  return (
    <Page>
      <PageHeader
        title={<em>{store.legalName}</em>}
        actions={<Badge tone={meta.tone}>{meta.label}</Badge>}
        description={
          <>
            Storefront details aren't self-editable in the MVP — contact admin if anything
            needs to change.
          </>
        }
      />

      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <SectionHeading title="Location" />
          <MetaList
            items={[
              { label: 'Address', value: store.address },
              { label: 'State code', value: store.stateCode, mono: true, hint: 'GST place-of-supply' },
              {
                label: 'Coordinates',
                value: `${store.lat.toFixed(5)}, ${store.lng.toFixed(5)}`,
                mono: true,
              },
            ]}
          />
        </section>

        <section>
          <SectionHeading title="Compliance & payouts" />
          <MetaList
            items={[
              { label: 'GSTIN', value: store.gstin, mono: true },
              {
                label: 'Platform fee',
                value: store.platformFeeBp > 0
                  ? `${(store.platformFeeBp / 100).toFixed(2)}%`
                  : 'Set on approval',
                ...(store.platformFeeBp > 0 ? { hint: 'Taken off each order' } : {}),
              },
              {
                label: 'Payout cadence',
                value: store.payoutCadenceDays > 0
                  ? `Every ${store.payoutCadenceDays} days`
                  : 'Set on approval',
              },
            ]}
          />
        </section>
      </div>

      <p className="mt-12 text-[11.5px] uppercase tracking-[0.14em] text-ink-3">
        Store ID <span className="font-mono normal-case tracking-normal">{store.id}</span>
      </p>
    </Page>
  );
}

function StoreCreateForm({ onCreated }: { onCreated: (s: Store) => void }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(Schema),
    defaultValues: {
      legalName: '',
      address: '',
      pincode: '',
      lat: 19.076,
      lng: 72.8777,
    },
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  // Coerced fields come back as `unknown` from RHF's typing, but defaults guarantee they're numbers.
  const lat = (watch('lat') as number | undefined) ?? 19.076;
  const lng = (watch('lng') as number | undefined) ?? 72.8777;

  // PIN code → city/state lookup. Fires once the field has 6 digits, results power the
  // address-line composition + GST state-code derivation on submit.
  const [lookup, setLookup] = useState<PincodeLookup | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  const pincode = watch('pincode');
  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) {
      setLookup(null);
      setLookupErr(null);
      return;
    }
    let cancelled = false;
    setLooking(true);
    setLookupErr(null);
    lookupPincode(pincode)
      .then((res) => {
        if (cancelled) return;
        if (!res) {
          setLookup(null);
          setLookupErr('No location found for that PIN code.');
          return;
        }
        if (!res.stateCode) {
          setLookup(res);
          setLookupErr(`Found ${res.state}, but the GST state code isn't recognised — contact admin.`);
        } else {
          setLookup(res);
          setLookupErr(null);
        }
        // Pre-position the map at the city center so the picker opens roughly where the
        // store is. The user fine-tunes from there. Best-effort — if Nominatim fails,
        // the existing form lat/lng is left untouched.
        geocodeLocation(`${res.city}, ${res.state}, ${res.country}`)
          .then((center) => {
            if (cancelled || !center) return;
            setValue('lat', center.lat, { shouldValidate: false });
            setValue('lng', center.lng, { shouldValidate: false });
          })
          .catch(() => {
            // Silent — geocoding is a nice-to-have, not required.
          });
      })
      .catch(() => {
        if (cancelled) return;
        setLookup(null);
        setLookupErr("Couldn't reach the PIN code service — try again.");
      })
      .finally(() => {
        if (!cancelled) setLooking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pincode]);

  const create = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!lookup || !lookup.stateCode) {
        throw new Error('Wait for the PIN code to verify before submitting.');
      }
      const fullAddress = `${values.address}, ${lookup.city}, ${lookup.state} ${values.pincode}, ${lookup.country}`;
      return api<Store>('/retailer/store', {
        method: 'POST',
        body: {
          legalName: values.legalName,
          address: fullAddress,
          stateCode: lookup.stateCode,
          lat: values.lat,
          lng: values.lng,
        },
      });
    },
    onSuccess: (s) => {
      toast.success('Storefront submitted — awaiting admin approval');
      onCreated(s);
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'store_already_exists'
          ? 'You already have a storefront on this account.'
          : code === 'retailer_not_approved'
            ? 'Your account needs admin approval first.'
            : e instanceof Error
              ? e.message
              : 'Could not submit storefront',
      );
    },
  });

  const submitDisabled = !lookup || !lookup.stateCode;

  return (
    <Page>
      <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16" data-stagger>
        {/* Left rail — editorial title + blurb (matches the auth-shell layout). */}
        <section className="lg:col-span-5 lg:sticky lg:top-8">
          <div className="kicker mb-4 text-ink-3">Storefront submission</div>
          <h1 className="editorial text-[44px] sm:text-[58px] lg:text-[68px] text-ink">
            Submit your <em>storefront</em>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-2">
            Your storefront is the physical anchor for products. The GSTIN you registered
            at signup is reused — fill in the rest on the right and admin will review.
          </p>
          <p className="mt-4 max-w-md text-[12px] uppercase tracking-[0.14em] text-ink-3">
            Platform fee &amp; payout cadence are set by admin on approval.
          </p>
        </section>

        {/* Right card — the form on a paper card with offset ink plate. */}
        <section className="lg:col-span-7">
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 translate-x-1.5 translate-y-1.5 bg-ink/85"
            />
            <div className="relative border border-ink bg-surface p-6 sm:p-8">
              <form
                onSubmit={handleSubmit((v) => create.mutate(v))}
                className="space-y-6"
              >
                <div>
                  <Label htmlFor="legalName" required>Storefront name</Label>
                  <Input
                    id="legalName"
                    placeholder="e.g. Acme Apparel — Bandra"
                    {...register('legalName')}
                  />
                  <FieldError>{errors.legalName?.message}</FieldError>
                </div>

                <div>
                  <Label htmlFor="address" required hint="House/flat, street, locality">
                    Street address
                  </Label>
                  <Textarea
                    id="address"
                    placeholder="e.g. 42 Linking Rd, Bandra West"
                    {...register('address')}
                  />
                  <FieldError>{errors.address?.message}</FieldError>
                </div>

                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <Label htmlFor="pincode" required hint="6 digits">PIN code</Label>
                    <Input
                      id="pincode"
                      mono
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="e.g. 400050"
                      {...register('pincode')}
                    />
                    <FieldError>{errors.pincode?.message}</FieldError>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>City · State · Country</Label>
                    <PincodeStatus
                      looking={looking}
                      lookup={lookup}
                      error={lookupErr}
                      pincode={pincode}
                    />
                  </div>
                </div>

                <div>
                  <Label required hint="for delivery routing">Pin location</Label>
                  <div className="flex flex-wrap items-center gap-3 border-b border-rule-strong py-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      iconLeft={<MapPin className="size-3.5" />}
                      onClick={(e) => {
                        // Belt-and-suspenders: type="button" already prevents form
                        // submission; this stops it on older browsers too.
                        e.preventDefault();
                        setPickerOpen(true);
                      }}
                    >
                      Pick on map
                    </Button>
                    <span className="font-mono text-[12.5px] text-ink-2">
                      {lat.toFixed(6)}, {lng.toFixed(6)}
                    </span>
                  </div>
                  <FieldError>{errors.lat?.message ?? errors.lng?.message}</FieldError>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-rule pt-5">
                  <Button
                    type="submit"
                    variant="ink"
                    caps
                    loading={isSubmitting || create.isPending}
                    disabled={submitDisabled}
                    title={submitDisabled ? 'Wait for the PIN code to verify' : undefined}
                  >
                    Submit for review
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>

      {/* Picker lives outside the <form> so React.lazy + Suspense can never interact
          with the form's render or submit lifecycle. */}
      <Suspense fallback={null}>
        {pickerOpen && (
          <MapPicker
            open={pickerOpen}
            initial={{ lat, lng }}
            onClose={() => setPickerOpen(false)}
            onConfirm={(newLat, newLng) => {
              setValue('lat', newLat, { shouldValidate: true });
              setValue('lng', newLng, { shouldValidate: true });
              setPickerOpen(false);
            }}
          />
        )}
      </Suspense>
    </Page>
  );
}

/** Live status block under the PIN code field — loading / result / error / placeholder. */
function PincodeStatus({
  looking,
  lookup,
  error,
  pincode,
}: {
  looking: boolean;
  lookup: PincodeLookup | null;
  error: string | null;
  pincode: string;
}) {
  if (looking) {
    return (
      <div className="flex h-10 items-center gap-2 border-b border-rule-strong text-[14px] text-ink-3">
        <Loader2 className="size-3.5 animate-spin" />
        Looking up…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-10 items-center border-b border-danger/50 text-[13.5px] text-danger">
        {error}
      </div>
    );
  }
  if (lookup) {
    return (
      <div className="flex h-10 items-center gap-1.5 border-b border-success/40 text-[14px] text-ink">
        <Check className="size-3.5 text-success" />
        <span className="font-medium">{lookup.city}</span>
        <span className="text-ink-4">·</span>
        <span>{lookup.state}</span>
        <span className="text-ink-4">·</span>
        <span className="text-ink-2">{lookup.country}</span>
        {lookup.stateCode && (
          <span className="ml-auto text-[11px] uppercase tracking-[0.14em] text-ink-3">
            GST {lookup.stateCode}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="flex h-10 items-center border-b border-rule text-[13px] text-ink-3 italic">
      {pincode.length > 0 ? `${pincode}…` : 'Enter PIN code to auto-fill'}
    </div>
  );
}
