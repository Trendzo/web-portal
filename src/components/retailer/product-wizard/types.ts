import { z } from 'zod';
import type { Listing } from '@/lib/types';

/** Scalar fields owned by react-hook-form (Steps 1 + 3). */
export const WizardFormSchema = z.object({
  name: z.string().trim().max(200),
  sku: z.string().trim().max(64).optional(),
  description: z.string().trim().max(2000).optional(),
  descriptionLong: z.string().optional(),
  brandId: z.string(),
  categoryId: z.string(),
  gender: z.enum(['her', 'him', 'unisex']).nullable(),
  occasion: z.array(z.string().trim().min(1).max(40)).max(10),
  ageGroups: z.array(z.string()).max(7),
  listingPolicy: z.enum(['return', 'replace', 'final_sale']),
  hsn: z.string().trim().max(8).optional(),
});
export type WizardFormValues = z.infer<typeof WizardFormSchema>;

/** A variant row in Step 2 (local, before/after persistence). */
export type VariantDraft = {
  /** Server id once persisted; absent for a not-yet-saved row. */
  id?: string;
  attributes: Record<string, string>;
  attributesLabel: string;
  /** '' means auto-generate on save. */
  sku: string;
  pricePaise: number | null;
  compareAtPrice: number | null;
  stock: number | null;
  imageUrls: string[];
  isActive: boolean;
};

export const WIZARD_STEPS = ['Basics & media', 'Variants', 'Details'] as const;

/** Client mirror of the backend's variant-completeness rule. */
export function isVariantDraftComplete(v: VariantDraft, galleryLength: number): boolean {
  return (
    v.pricePaise !== null &&
    v.pricePaise > 0 &&
    !!v.sku.trim() &&
    v.stock !== null &&
    (v.imageUrls.length > 0 || galleryLength > 0)
  );
}

// ===== Parent-child (color → sizes) variant structure =====

/** Wizard-side mirror of the listing's `variantMode`. */
export type VariantMode = 'single' | 'color_size' | 'custom';

/** A size row under a color group — identity (attributes/label) is server-derived.
 *  `size: ''` means the row has NO size (a one-size / colour-only variant). */
export type SizeDraft = VariantDraft & { size: string };

/** One color card in the grouped editor. */
export type GroupDraft = {
  /** Stable React key before the group is persisted. */
  clientKey: string;
  /** Server id once persisted. */
  id?: string;
  name: string;
  /** Optional #RRGGBB swatch. */
  colorHex: string | null;
  sortOrder: number;
  sizes: SizeDraft[];
  /**
   * "No colour" card — a size-only product. Its variants live in the listing's
   * colour-less DEFAULT group server-side, so each variant's identity is just its
   * size ("M") with no colour key. `name` is unused for display.
   */
  isNoColor?: boolean;
};

/** Sentinel for a row with no size (a one-size variant). */
export const NO_SIZE = '';

let groupKeyCounter = 0;
export function nextGroupKey(): string {
  groupKeyCounter += 1;
  return `g${groupKeyCounter}-${Date.now()}`;
}

function variantToDraft(v: NonNullable<Listing['variants']>[number]): VariantDraft {
  return {
    id: v.id,
    attributes: v.attributes,
    attributesLabel: v.attributesLabel,
    sku: v.sku ?? '',
    pricePaise: v.pricePaise,
    compareAtPrice: v.compareAtPrice,
    stock: v.stock,
    imageUrls: v.imageUrls,
    isActive: v.isActive,
  };
}

/** The variant's size value under either key casing (legacy rows used "Size"). */
function sizeOf(attrs: Record<string, string>): string | null {
  for (const key of Object.keys(attrs)) {
    if (key.toLowerCase() === 'size') return attrs[key] ?? null;
  }
  return null;
}

// ===== Staged (unfinished) variant data, shared with the retailer app =====
//
// `draftVariantData` is a draft-only column both clients read and write, so the
// shapes below MUST match the app's (basePrice/baseMrp/single/colors). Only a
// `custom` product - which the app cannot express - uses the web-only `web` key.

const STAGED_KEYS = ['basePrice', 'baseMrp', 'single', 'colors', 'web'] as const;

type StagedSize = {
  size: string; sku: string; price: string; mrp?: string; stock: string;
  imageUrls: string[]; serverVariantId?: string;
};
type StagedColor = { name: string; colorHex?: string; sizes: StagedSize[] };
type StagedData = {
  basePrice?: string; baseMrp?: string;
  single?: { sku?: string; size?: string; stock?: string; imageUrls?: string[] };
  colors?: StagedColor[];
  web?: { mode: VariantMode; variants: VariantDraft[]; groups: GroupDraft[] };
};

const paiseToRupees = (paise: number | null): string =>
  paise === null || paise === undefined ? '' : String(paise / 100);
const rupeesToPaise = (value: string | undefined): number | null => {
  const n = Number((value ?? '').trim());
  return value?.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

/** Everything in `draftVariantData` that is not variant staging stays untouched. */
export function withoutStagedVariants(
  existing: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const rest = { ...(existing ?? {}) };
  for (const key of STAGED_KEYS) delete rest[key];
  return Object.keys(rest).length ? rest : null;
}

/** Wizard state -> the payload stored in `listing.draftVariantData`. */
export function stageVariantState(
  existing: Record<string, unknown> | null | undefined,
  state: { mode: VariantMode; variants: VariantDraft[]; groups: GroupDraft[] },
): Record<string, unknown> {
  const base = withoutStagedVariants(existing) ?? {};
  if (state.mode === 'single') {
    const v = state.variants[0];
    return {
      ...base,
      basePrice: paiseToRupees(v?.pricePaise ?? null),
      baseMrp: paiseToRupees(v?.compareAtPrice ?? null),
      single: { sku: v?.sku ?? '', size: '', stock: v?.stock === null || v?.stock === undefined ? '0' : String(v.stock),
        imageUrls: v?.imageUrls ?? [] },
    };
  }
  if (state.mode === 'color_size') {
    return {
      ...base, basePrice: '', baseMrp: '',
      colors: state.groups.map((g): StagedColor => ({
        name: g.isNoColor ? '' : g.name,
        ...(g.colorHex ? { colorHex: g.colorHex } : {}),
        sizes: g.sizes.map((r): StagedSize => ({
          size: r.size, sku: r.sku, price: paiseToRupees(r.pricePaise),
          ...(r.compareAtPrice !== null ? { mrp: paiseToRupees(r.compareAtPrice) } : {}),
          stock: r.stock === null ? '' : String(r.stock), imageUrls: r.imageUrls,
          ...(r.id ? { serverVariantId: r.id } : {}),
        })),
      })),
    };
  }
  return {
    ...base,
    web: {
      mode: state.mode, variants: state.variants,
      groups: state.groups.map(({ clientKey: _k, ...group }) => { void _k; return group as GroupDraft; }),
    },
  };
}

function stagedRowToDraft(row: StagedSize, baseMrp: string | undefined): SizeDraft {
  return {
    ...(row.serverVariantId ? { id: row.serverVariantId } : {}),
    attributes: row.size ? { size: row.size } : {},
    attributesLabel: row.size,
    size: row.size, sku: row.sku,
    pricePaise: rupeesToPaise(row.price),
    compareAtPrice: rupeesToPaise(row.mrp ?? baseMrp),
    stock: row.stock.trim() === '' ? null : Number(row.stock),
    imageUrls: row.imageUrls, isActive: true,
  };
}

/**
 * Seed the wizard's variant state from a loaded listing. `variantMode` is the
 * server's record of the structure; grouped listings bucket their flat
 * variants by `groupId` (the empty default group is hidden from the editor).
 */
export function seedVariantState(l: Listing): {
  mode: VariantMode;
  groups: GroupDraft[];
  variants: VariantDraft[];
} {
  const staged = (l.draftVariantData ?? {}) as StagedData;
  if (staged.web) return {
    mode: staged.web.mode,
    variants: staged.web.variants,
    groups: staged.web.groups.map(g => ({ ...g, clientKey: nextGroupKey() })),
  };
  const mode = l.variantMode;
  const flat = (l.variants ?? []).map(variantToDraft);
  if (mode === 'single') {
    return { mode, groups: [], variants: overlayStagedSingle(flat, staged) };
  }
  if (mode !== 'color_size') {
    return { mode, groups: [], variants: flat };
  }

  const byGroup = new Map<string, VariantDraft[]>();
  for (const v of l.variants ?? []) {
    const list = byGroup.get(v.groupId) ?? [];
    list.push(variantToDraft(v));
    byGroup.set(v.groupId, list);
  }
  const groups: GroupDraft[] = (l.variantGroups ?? [])
    .filter((g) => !g.isDefault || (byGroup.get(g.id)?.length ?? 0) > 0)
    .map((g) => ({
      clientKey: nextGroupKey(),
      id: g.id,
      name: g.name,
      colorHex: g.colorHex,
      sortOrder: g.sortOrder,
      // The default group has no colour - it's the "no colour" (size-only) card.
      isNoColor: g.isDefault,
      sizes: (byGroup.get(g.id) ?? []).map((d) => ({
        ...d,
        // A colour-only variant carries no size key - seed it as the no-size row.
        size: sizeOf(d.attributes) ?? '',
      })),
    }));
  return { mode, groups: overlayStagedColors(groups, staged), variants: flat };
}

/** Rows entered in the app (or an earlier web session) that are not priced variants yet. */
function overlayStagedColors(groups: GroupDraft[], staged: StagedData): GroupDraft[] {
  const result = groups.map((g) => ({ ...g, sizes: [...g.sizes] }));
  for (const color of staged.colors ?? []) {
    const name = color.name.trim().toLowerCase();
    let group = result.find((g) => (name ? !g.isNoColor && g.name.toLowerCase() === name : g.isNoColor));
    if (!group) {
      group = {
        clientKey: nextGroupKey(), name: color.name, colorHex: color.colorHex ?? null,
        sortOrder: result.length, isNoColor: !name, sizes: [],
      };
      result.push(group);
    }
    for (const row of color.sizes) {
      const draft = stagedRowToDraft(row, staged.baseMrp);
      const at = group.sizes.findIndex((s) => row.serverVariantId
        ? s.id === row.serverVariantId : !s.id && s.size.toLowerCase() === row.size.toLowerCase());
      if (at >= 0) group.sizes[at] = { ...group.sizes[at]!, ...draft };
      else group.sizes.push(draft);
    }
  }
  return result;
}

function overlayStagedSingle(flat: VariantDraft[], staged: StagedData): VariantDraft[] {
  if (!staged.single && !staged.basePrice && !staged.baseMrp) return flat;
  const current = flat[0];
  const draft: VariantDraft = {
    ...(current ?? { attributes: {}, attributesLabel: '', isActive: true, imageUrls: [] }),
    sku: staged.single?.sku ?? current?.sku ?? '',
    pricePaise: staged.basePrice !== undefined ? rupeesToPaise(staged.basePrice) : current?.pricePaise ?? null,
    compareAtPrice: staged.baseMrp !== undefined ? rupeesToPaise(staged.baseMrp) : current?.compareAtPrice ?? null,
    stock: staged.single?.stock !== undefined && staged.single.stock.trim() !== ''
      ? Number(staged.single.stock) : current?.stock ?? null,
    imageUrls: staged.single?.imageUrls ?? current?.imageUrls ?? [],
  };
  return [draft, ...flat.slice(1)];
}
