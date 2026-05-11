import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AttributeAxisType, AttributeTemplate } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const AXIS_TYPES: AttributeAxisType[] = ['enum', 'free_text', 'numeric', 'color'];

export default function AttributeTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = id === 'new' || id === undefined;
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'attribute-templates', id],
    queryFn: () => api<AttributeTemplate>(`/retailer/attribute-templates/${id}`),
    enabled: !isNew,
  });
  const [draft, setDraft] = useState<AttributeTemplate>({
    id: 'new',
    name: '',
    axes: [{ name: '', type: 'enum', allowedValues: [] }],
    usedByListingCount: 0,
    updatedAt: null,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  if (!isNew && isLoading) return <Page><Skeleton className="h-72" /></Page>;
  if (!isNew && !data) return <Page><PageHeader title="Template not found" /></Page>;

  const orphanWarning = (data?.usedByListingCount ?? 0) > 0;

  async function save() {
    setSaving(true);
    try {
      if (isNew) {
        const r = await api<{ id: string }>('/retailer/attribute-templates', {
          method: 'POST',
          body: { name: draft.name, axes: draft.axes },
        });
        await qc.invalidateQueries({ queryKey: ['retailer', 'attribute-templates'] });
        toast.success('Template created');
        navigate(`/retailer/attribute-templates/${r.id}`);
      } else {
        await api(`/retailer/attribute-templates/${id}`, {
          method: 'PATCH',
          body: { name: draft.name, axes: draft.axes },
        });
        await qc.invalidateQueries({ queryKey: ['retailer', 'attribute-templates'] });
        toast.success('Template saved');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <PageHeader
        kicker="Catalog"
        title={isNew ? 'New attribute template' : `Edit: ${draft.name || data?.name}`}
        description="Editing axes on a template that's in use can orphan variants. Add new axes freely; remove axes only when the impact is acceptable."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to="/retailer/attribute-templates">Back</Link>
            </Button>
            <Button variant="accent" onClick={save} disabled={saving || !draft.name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      />

      {orphanWarning && (
        <div className="mb-4 rounded-md border border-warning/30 bg-warning-soft/30 p-3 text-[12.5px] text-warning">
          <strong>Heads up:</strong> {data?.usedByListingCount} listing(s) depend on this template.
          Removing or renaming an axis will orphan their variants.
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-5">
          <div>
            <Label htmlFor="tpl-name" required>Template name</Label>
            <Input id="tpl-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </div>

          <div>
            <SectionHeading kicker="Axes" title="Variant axes" />
            <ul className="space-y-3">
              {draft.axes.map((axis, idx) => (
                <li key={idx} className="rounded-lg border border-line bg-bg-2/30 p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
                    <div>
                      <Label htmlFor={`axis-${idx}-name`} required>Axis name</Label>
                      <Input
                        id={`axis-${idx}-name`}
                        value={axis.name}
                        onChange={(e) => updateAxis(idx, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`axis-${idx}-type`}>Type</Label>
                      <Select
                        value={axis.type}
                        onValueChange={(v) => updateAxis(idx, { type: v as AttributeAxisType })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AXIS_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      iconLeft={<Trash2 className="size-3.5" />}
                      onClick={() => removeAxis(idx)}
                      disabled={draft.axes.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                  <div>
                    <Label>Allowed values</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {axis.allowedValues.map((v) => (
                        <Badge key={v} tone="neutral" className="cursor-pointer" onClick={() => updateAxis(idx, { allowedValues: axis.allowedValues.filter((x) => x !== v) })}>
                          {v} ×
                        </Badge>
                      ))}
                      <input
                        type="text"
                        placeholder="Type and press Enter…"
                        className="rounded-md border border-line-2 bg-bg px-2 py-1 text-[12.5px] focus:border-ink focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const v = (e.target as HTMLInputElement).value.trim();
                            if (v && !axis.allowedValues.includes(v)) {
                              updateAxis(idx, { allowedValues: [...axis.allowedValues, v] });
                            }
                            (e.target as HTMLInputElement).value = '';
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              iconLeft={<Plus className="size-3.5" />}
              onClick={() =>
                setDraft((d) => ({ ...d, axes: [...d.axes, { name: '', type: 'enum', allowedValues: [] }] }))
              }
            >
              Add axis
            </Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  );

  function updateAxis(idx: number, patch: Partial<AttributeTemplate['axes'][number]>) {
    setDraft((d) => ({
      ...d,
      axes: d.axes.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  }
  function removeAxis(idx: number) {
    setDraft((d) => ({ ...d, axes: d.axes.filter((_, i) => i !== idx) }));
  }
}
