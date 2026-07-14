import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ApplicationDocumentKind } from '@/lib/types';

export type ClarificationFieldOption = {
  value: string;
  label: string;
};

const DOC_KINDS: { value: ApplicationDocumentKind; label: string }[] = [
  { value: 'gst_certificate', label: 'GST certificate' },
  { value: 'pan', label: 'PAN' },
  { value: 'address_proof', label: 'Address proof' },
  { value: 'bank_proof', label: 'Bank proof (cancelled cheque)' },
  { value: 'storefront_photo', label: 'Storefront photo' },
  { value: 'other', label: 'Other' },
];

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  questionLabel?: string;
  questionPlaceholder?: string;
  fields: ClarificationFieldOption[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    fieldKey: string;
    question: string;
    requestedDocKinds: ApplicationDocumentKind[];
  }) => void;
};

/**
 * Used during application/document review. Admin picks the field they need
 * the retailer to address and writes the clarification question. The retailer
 * receives this on their dashboard's clarification thread panel.
 */
export function ClarificationRequestDialog({
  open,
  title = 'Request clarification',
  description = 'Send a question to the retailer. They will see it on their dashboard alongside the relevant field.',
  questionLabel = 'Question',
  questionPlaceholder = 'What would you like the retailer to clarify?',
  fields,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const [fieldKey, setFieldKey] = useState<string>(fields[0]?.value ?? '');
  const [question, setQuestion] = useState('');
  const [picked, setPicked] = useState<Set<ApplicationDocumentKind>>(new Set());

  useEffect(() => {
    if (open) {
      setFieldKey(fields[0]?.value ?? '');
      setQuestion('');
      setPicked(new Set());
    }
  }, [open, fields]);

  function toggleDoc(kind: ApplicationDocumentKind) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const trimmed = question.trim();
  const questionError = trimmed.length === 0 ? '' : trimmed.length < 5 ? 'Question must be at least 5 characters' : '';
  const disabled = trimmed.length < 5 || Boolean(questionError) || !fieldKey;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label required>Field</Label>
            <Select value={fieldKey} onValueChange={setFieldKey}>
              <SelectTrigger><SelectValue placeholder="Choose field…" /></SelectTrigger>
              <SelectContent>
                {fields.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="clarification-question" required>{questionLabel}</Label>
            <Textarea
              id="clarification-question"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={questionPlaceholder}
            />
            <FieldError>{questionError}</FieldError>
          </div>
          <div>
            <Label hint="Optional — pick documents the applicant must (re)upload">
              Request documents
            </Label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {DOC_KINDS.map((d) => (
                <label
                  key={d.value}
                  className="flex items-center gap-2 rounded-md border border-line bg-bg-2/40 px-2.5 py-1.5 text-[12.5px] text-ink-2 cursor-pointer hover:bg-bg-2/70"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={picked.has(d.value)}
                    onChange={() => toggleDoc(d.value)}
                  />
                  <span>{d.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="accent"
            disabled={disabled}
            loading={loading ?? false}
            onClick={() =>
              onConfirm({ fieldKey, question: trimmed, requestedDocKinds: Array.from(picked) })
            }
          >
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
