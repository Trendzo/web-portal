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

export type ClarificationFieldOption = {
  value: string;
  label: string;
};

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  fields: ClarificationFieldOption[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (payload: { fieldKey: string; question: string }) => void;
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
  fields,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const [fieldKey, setFieldKey] = useState<string>(fields[0]?.value ?? '');
  const [question, setQuestion] = useState('');

  useEffect(() => {
    if (open) {
      setFieldKey(fields[0]?.value ?? '');
      setQuestion('');
    }
  }, [open, fields]);

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
            <Label htmlFor="clarification-question" required>Question</Label>
            <Textarea
              id="clarification-question"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like the retailer to clarify?"
            />
            <FieldError>{questionError}</FieldError>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="accent"
            disabled={disabled}
            loading={loading ?? false}
            onClick={() => onConfirm({ fieldKey, question: trimmed })}
          >
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
