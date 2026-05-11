import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/status';
import type { AttributeTemplate } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

export default function RetailerAttributeTemplates() {
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'attribute-templates'],
    queryFn: () => api<AttributeTemplate[]>('/retailer/attribute-templates'),
  });
  const list = data ?? [];

  return (
    <Page>
      <PageHeader
        kicker="Catalog"
        title="Attribute templates"
        description="Reusable variant-axis schemas. Apply a template at listing creation to keep size/color/etc. consistent across products."
        actions={
          <Button asChild iconLeft={<Plus className="size-3.5" />}>
            <Link to="/retailer/attribute-templates/new">New template</Link>
          </Button>
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
                    <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                      <Link to={`/retailer/attribute-templates/${t.id}`}>Edit</Link>
                    </Button>
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
