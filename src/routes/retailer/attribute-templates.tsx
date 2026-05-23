import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { AttributeTemplate, Category, Listing } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RetailerAttributeTemplates() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'attribute-templates'],
    queryFn: () => api<AttributeTemplate[]>('/retailer/attribute-templates'),
  });
  const categoriesQ = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => api<Category[]>('/catalog/categories'),
  });
  const listingsQ = useQuery({
    queryKey: ['retailer', 'listings'],
    queryFn: () => api<Listing[]>('/retailer/listings'),
  });

  // Build map: categoryId → Set<templateId>
  const categoryTemplateIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of listingsQ.data ?? []) {
      if (!l.templateId) continue;
      if (!map.has(l.categoryId)) map.set(l.categoryId, new Set());
      map.get(l.categoryId)!.add(l.templateId);
    }
    return map;
  }, [listingsQ.data]);

  const allTemplates = data ?? [];
  const list = useMemo(() => {
    if (categoryFilter === 'all') return allTemplates;
    const allowedIds = categoryTemplateIds.get(categoryFilter);
    if (!allowedIds) return [];
    return allTemplates.filter((t) => allowedIds.has(t.id));
  }, [allTemplates, categoryFilter, categoryTemplateIds]);

  return (
    <Page>
      <PageHeader
        kicker="Catalog"
        title="Attribute templates"
        description="Reusable variant-axis schemas. Apply a template at listing creation to keep size/color/etc. consistent across products."
        actions={
          <div className="flex items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(categoriesQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild iconLeft={<Plus className="size-3.5" />}>
              <Link to="/retailer/attribute-templates/new">New template</Link>
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : list.length === 0 ? (
        <Empty kicker="None yet" title="No templates yet. Create one to define variant axes." />
      ) : (
        <ul className="space-y-2">
          {list.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14.5px] font-semibold text-ink">{t.name}</span>
                      {t.isPlatformDefault && <Badge tone="neutral" flat>Platform</Badge>}
                    </div>
                    <div className="mt-1 text-[12px] text-ink-3">
                      Used by {t.usedByListingCount} listing{t.usedByListingCount === 1 ? '' : 's'}
                      {t.updatedAt && <> · Updated {formatAge(t.updatedAt)}</>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.axes.map((a) => (
                        <Badge key={a.name} tone="info" flat>
                          {a.name} ({a.type}) · {a.allowedValues.length} value{a.allowedValues.length === 1 ? '' : 's'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {!t.isPlatformDefault && (
                    <div className="flex items-center gap-2">
                      <DeleteTemplateButton template={t} />
                      <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                        <Link to={`/retailer/attribute-templates/${t.id}`}>Edit</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </Page>
  );
}

function DeleteTemplateButton({ template }: { template: AttributeTemplate }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const inUse = template.usedByListingCount > 0;

  const del = useMutation({
    mutationFn: () =>
      api(`/retailer/attribute-templates/${template.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Template deleted');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['retailer', 'attribute-templates'] });
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(
        code === 'invalid_state'
          ? 'Template is in use by listings — remove from listings first.'
          : e instanceof Error
            ? e.message
            : 'Could not delete',
      );
    },
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={inUse}
        title={inUse ? 'Remove from listings first' : 'Delete template'}
        iconLeft={<Trash2 className="size-3.5" />}
        onClick={() => setOpen(true)}
        className="text-ink-3 hover:text-danger"
      >
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-ink">{template.name}</span> will be removed.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={del.isPending} onClick={() => del.mutate()}>
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
