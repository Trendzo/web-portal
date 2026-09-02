import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { ThemeDraft } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';

/**
 * Minimal birth certificate for a theme: name, slug, optional description. Everything
 * else (colours, chrome, scheduling, audience) lives in the editor the caller opens
 * right after — so the new row is born disabled with safe neutral defaults and cannot
 * leak to customers by existing.
 */

// Mirrors the backend validator exactly (2-80 chars) — a 1-char slug used to
// pass here and 422 on submit.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateThemeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');

  // Reset when the dialog closes so a cancelled draft never leaks into the next open.
  useEffect(() => {
    if (!open) {
      setName('');
      setSlug('');
      setSlugTouched(false);
      setDescription('');
    }
  }, [open]);

  const slugError =
    slug && !SLUG_RE.test(slug)
      ? 'Lowercase letters, digits and hyphens; must start with a letter or digit'
      : '';

  const create = useMutation({
    mutationFn: () =>
      api<ThemeDraft>('/admin/cms/themes', {
        method: 'POST',
        body: {
          slug,
          name: name.trim(),
          description: description.trim() || null,
          isEnabled: false,
          priority: 100,
          tokens: {},
          chrome: { statusBarStyle: 'dark', header: { kind: 'default' }, tabBar: {} },
          decor: { kind: 'none', respectReduceMotion: true },
          copy: {},
        },
      }),
    onSuccess: (row) => {
      toast.success(`Theme "${row.name}" created`);
      void qc.invalidateQueries({ queryKey: ['admin', 'themes'] });
      onCreated(row.id);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Create failed'),
  });

  const disabled = !name.trim() || !SLUG_RE.test(slug);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New theme</DialogTitle>
          <DialogDescription>
            Starts as a disabled draft — nothing reaches phones until it is enabled and
            published.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="theme-create-name" required>
              Name
            </Label>
            <Input
              id="theme-create-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(kebab(e.target.value));
              }}
              placeholder="Diwali 2026"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="theme-create-slug" required hint="stable identifier — hard to change later">
              Slug
            </Label>
            <Input
              id="theme-create-slug"
              mono
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="diwali-2026"
            />
            <FieldError>{slugError}</FieldError>
          </div>
          <div>
            <Label htmlFor="theme-create-desc">Description</Label>
            <Textarea
              id="theme-create-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this theme is for (internal note)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="solid"
            loading={create.isPending}
            disabled={disabled}
            onClick={() => create.mutate()}
          >
            Create theme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
