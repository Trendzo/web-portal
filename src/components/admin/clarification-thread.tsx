import { useState } from 'react';
import { ShieldCheck, Store } from 'lucide-react';
import type { ClarificationMessage } from '@/lib/types';
import { formatAge } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Empty } from '@/components/ui/empty';

type Props = {
  messages: ClarificationMessage[];
  /** When true, render the reply input below the thread (admin or retailer view). */
  canReply?: boolean;
  /** Author role used when posting a new reply. Defaults to admin. */
  replyAs?: 'admin' | 'retailer';
  onReply?: (body: string) => void;
};

/**
 * Conversation pane for application clarifications. Renders messages oldest →
 * newest, with author-icon column. Used in admin/applications-detail and
 * retailer/dashboard pre-live block.
 */
export function ClarificationThread({ messages, canReply = false, replyAs = 'admin', onReply }: Props) {
  const [reply, setReply] = useState('');

  if (messages.length === 0 && !canReply) {
    return <Empty kicker="No messages" title="Nothing to clarify yet." />;
  }

  const ordered = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div className="space-y-3">
      {ordered.length === 0 ? (
        <p className="text-[12.5px] text-ink-3 italic">No messages yet — start the conversation below.</p>
      ) : (
        <ul className="space-y-3">
          {ordered.map((m) => {
            const Icon = m.authorKind === 'admin' ? ShieldCheck : Store;
            const tone =
              m.authorKind === 'admin'
                ? 'border-info/30 bg-info-soft/30'
                : 'border-line bg-bg-2/40';
            return (
              <li key={m.id} className={`flex items-start gap-3 rounded-md border px-3 py-2.5 ${tone}`}>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-bg border border-line text-ink-2">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[12.5px] font-semibold text-ink">{m.authorLabel}</span>
                    {m.fieldKey && (
                      <span className="rounded bg-bg-3 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-3">
                        {m.fieldKey}
                      </span>
                    )}
                    <span className="text-[11px] text-ink-4">{formatAge(m.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-ink-2 leading-relaxed">{m.body}</p>
                  {m.attachments.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.attachments.map((att) => (
                        <span key={att} className="rounded border border-line bg-bg px-1.5 py-0.5 font-mono text-[10.5px] text-ink-3">
                          {att}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canReply && (
        <div className="rounded-md border border-line bg-bg p-3">
          <Textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={replyAs === 'retailer' ? 'Write your response…' : 'Reply to the retailer…'}
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              variant="accent"
              disabled={reply.trim().length < 3}
              onClick={() => {
                onReply?.(reply.trim());
                setReply('');
              }}
            >
              Send reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
