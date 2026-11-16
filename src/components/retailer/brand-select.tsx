/**
 * Brand picker with type-to-search and inline "create new brand" - self-contained
 * (owns its own brands query + create mutation). Shared by create and edit flows.
 *
 * Built on SearchablePicker (a popover list), not a Radix Select: the search box
 * keeps typing out of the trigger's typeahead, and a brand created a moment ago
 * is selectable immediately because the label is looked up from the cached list.
 */
import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { Brand } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { MediaGallery } from '@/components/ui/media-gallery';
import { SearchablePicker } from '@/components/ui/searchable-picker';

/** URL-safe slug matching the server's ^[a-z0-9]+(?:-[a-z0-9]+)*$ rule. */
export function slugifyBrandName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Props = {
  value: string;
  onChange: (brandId: string) => void;
  error?: string | undefined;
};

export function BrandSelect({ value, onChange, error }: Props) {
  const qc = useQueryClient();
  const brands = useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: () => api<Brand[]>('/catalog/brands'),
  });
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const createBrand = useMutation({
    mutationFn: async (name: string) => {
      const slug = slugifyBrandName(name);
      try {
        return await api<Brand>('/retailer/brands', {
          method: 'POST',
          body: { name: name.trim(), slug, ...(newLogoUrl ? { logoUrl: newLogoUrl } : {}) },
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409 && /slug/i.test(e.message)) {
          return await api<Brand>('/retailer/brands', {
            method: 'POST',
            body: {
              name: name.trim(),
              slug: `${slug}-2`,
              ...(newLogoUrl ? { logoUrl: newLogoUrl } : {}),
            },
          });
        }
        throw e;
      }
    },
    onSuccess: (created) => {
      qc.setQueryData<Brand[]>(['catalog', 'brands'], (old) =>
        old ? [...old, created] : [created],
      );
      onChange(created.id);
      setCreating(false);
      setNewName('');
      setNewLogoUrl(null);
      setCreateError(null);
      toast.success(`Brand "${created.name}" created`);
      void qc.invalidateQueries({ queryKey: ['catalog', 'brands'] });
      void qc.invalidateQueries({ queryKey: ['retailer', 'brands'] });
    },
    onError: async (e, name) => {
      if (e instanceof ApiError && e.status === 409 && /named/i.test(e.message)) {
        const fresh = await qc.fetchQuery({
          queryKey: ['catalog', 'brands'],
          queryFn: () => api<Brand[]>('/catalog/brands'),
        });
        const match = fresh.find((b) => b.name.toLowerCase() === name.trim().toLowerCase());
        if (match) {
          onChange(match.id);
          setCreating(false);
          setNewName('');
          setNewLogoUrl(null);
          setCreateError(null);
          toast.info(`Brand "${match.name}" already exists — selected it for you.`);
          return;
        }
      }
      setCreateError(e instanceof Error ? e.message : 'Could not create brand');
    },
  });

  const submit = () => {
    if (newName.trim() && slugifyBrandName(newName)) createBrand.mutate(newName);
  };

  return (
    <div>
      <Label hint="Optional">Brand</Label>
      <SearchablePicker
        options={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
        value={value}
        placeholder="Pick a brand"
        searchPlaceholder="Search brands…"
        loading={brands.isLoading && !brands.data}
        emptyMessage={brands.isError ? 'Brands could not be loaded. Close and reopen to retry.' : 'No brands yet - create one below'}
        onChange={onChange}
        footer={(close) => (
          <button
            type="button"
            onClick={() => {
              close();
              setCreating(true);
              setCreateError(null);
              requestAnimationFrame(() => nameInputRef.current?.focus());
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-accent hover:bg-bg-2"
          >
            <Plus className="size-3.5" /> Create new brand…
          </button>
        )}
      />
      <FieldError>{error}</FieldError>

      {creating && (
        <div className="mt-2 rounded-xs border border-rule bg-paper-2/40 p-4 space-y-3">
          <div className="text-[12.5px] font-medium text-ink">Create a new brand</div>
          <div>
            <Label htmlFor="new-brand-name" required>
              Brand name
            </Label>
            <Input
              id="new-brand-name"
              ref={nameInputRef}
              autoFocus
              placeholder="e.g. House of Asha"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setCreateError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <p className="mt-1 font-mono text-[11px] text-ink-3">
              slug: {slugifyBrandName(newName) || '—'}
            </p>
            {createError && <FieldError>{createError}</FieldError>}
          </div>
          <div>
            <Label hint="Optional">Logo</Label>
            <MediaGallery
              urls={newLogoUrl ? [newLogoUrl] : []}
              onChange={(urls) => setNewLogoUrl(urls[0] ?? null)}
              uploadFolder="brands/logos"
              maxImages={1}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCreating(false);
                setNewName('');
                setNewLogoUrl(null);
                setCreateError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ink"
              size="sm"
              loading={createBrand.isPending}
              disabled={!newName.trim() || !slugifyBrandName(newName)}
              onClick={submit}
            >
              Create brand
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
