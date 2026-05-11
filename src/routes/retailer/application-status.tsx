import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyableId } from '@/components/ui/copyable-id';
import { api } from '@/lib/api';

type ApplicationStatusData = {
  id: string;
  status: string;
  submittedAt: string;
  decidedAt?: string | null;
  decisionReason?: string | null;
};

export default function ApplicationStatus() {
  const [params] = useSearchParams();
  const appId = params.get('id') ?? '';
  const email = params.get('email') ?? '';
  const status = params.get('status') === 'rejected' ? 'rejected' : 'pending';
  const rejected = status === 'rejected';

  const { data: appData } = useQuery<ApplicationStatusData>({
    queryKey: ['application-status', appId, email],
    queryFn: () =>
      api<ApplicationStatusData>(`/applications/${appId}/status?email=${encodeURIComponent(email)}`),
    enabled: Boolean(appId && email),
    retry: false,
  });

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Icon */}
        <div className={`mx-auto mb-6 flex size-16 items-center justify-center rounded-full ${rejected ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
          {rejected ? <XCircle className="size-8" /> : <Clock className="size-8" />}
        </div>

        {/* Heading */}
        <h1 className="font-display italic text-[32px] sm:text-[38px] text-ink text-center leading-tight">
          {rejected ? 'Application not approved' : 'Application under review'}
        </h1>

        <p className="mt-4 text-center text-[14px] text-ink-2 leading-relaxed">
          {rejected
            ? 'Your application did not meet our current criteria. Contact support if you believe this is a mistake.'
            : <>The ClosetX compliance team is reviewing your documents and will reach out to{email && <> <strong>{email}</strong></>} within 2–3 business days.</>}
        </p>

        {/* Application reference */}
        {appId && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[12px] uppercase tracking-[0.13em] text-ink-3">Application reference</span>
            <CopyableId value={appId} label="application id" className="text-[13px] [&>span]:max-w-none" />
          </div>
        )}

        {/* What happens next — pending only */}
        {!rejected && (
          <div className="mt-6 rounded-lg border border-line bg-bg p-5">
            <div className="kicker mb-3 text-ink-3">What happens next</div>
            <ul className="space-y-2">
              {[
                'Admin reviews your GSTIN, PAN, and bank details.',
                'You may receive a clarification request via email if anything needs correction.',
                'Once approved, your account is activated and you can log in with the password you set.',
                appId
                  ? `Quote your reference ID (${appId}) when contacting ClosetX support or admin.`
                  : 'Keep your application reference ID handy when contacting ClosetX support or admin.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-ink-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/retailer/login">← Back to sign in</Link>
          </Button>
        </div>

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.14em] text-ink-4">
          ClosetX Partner Portal
        </p>

        {/* Submission summary — always shown when appId present */}
        {appId && (
          <div className="mt-10 rounded-lg border border-line bg-bg p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="size-4 text-ink-3 shrink-0" />
              <span className="kicker text-ink-3">Submitted application</span>
            </div>
            <dl className="space-y-3">
              <Row label="Application ID">
                <CopyableId value={appId} label="application id" className="text-[12px] [&>span]:max-w-none" />
              </Row>
              {email && (
                <Row label="Email">
                  <span className="text-[13px] text-ink-2">{email}</span>
                </Row>
              )}
              <Row label="Status">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                  status === 'rejected' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                }`}>
                  {(appData?.status ?? status).replace('_', ' ')}
                </span>
              </Row>
              {appData?.submittedAt && (
                <Row label="Submitted">
                  <span className="text-[13px] text-ink-2">{fmt(appData.submittedAt)}</span>
                </Row>
              )}
              {appData?.decidedAt && (
                <Row label="Decided">
                  <span className="text-[13px] text-ink-2">{fmt(appData.decidedAt)}</span>
                </Row>
              )}
              {appData?.decisionReason && (
                <Row label="Reason">
                  <span className="text-[13px] text-ink-2 leading-relaxed">{appData.decisionReason}</span>
                </Row>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-3 pt-0.5 shrink-0">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
