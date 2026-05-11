// MOCK_DEPENDENCY: §1 Identity & Access (hardware-key step is UI-only until
// backend issues a WebAuthn challenge endpoint).

import { useState } from 'react';
import { Check, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MockDataBadge } from '@/components/ui/mock-data-badge';

type Props = {
  onSkip?: () => void;
};

type Phase = 'idle' | 'tapping' | 'verified';

export function HardwareKeyChallenge({ onSkip }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');

  const tap = () => {
    setPhase('tapping');
    setTimeout(() => setPhase('verified'), 800);
  };

  return (
    <div className="rounded-md border border-line bg-bg-2/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
          <ShieldCheck className="size-4 text-accent" />
          Hardware key required for admin sign-in
        </div>
        <MockDataBadge label="Mocked" />
      </div>
      <p className="text-[12.5px] text-ink-3 leading-relaxed">
        Insert your security key and tap it to complete the challenge. The mock simulator below stands
        in for the WebAuthn round-trip until the backend challenge endpoint lands.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant={phase === 'verified' ? 'outline' : 'accent'}
          onClick={tap}
          disabled={phase !== 'idle'}
          iconLeft={
            phase === 'tapping' ? <Loader2 className="size-3.5 animate-spin" /> :
            phase === 'verified' ? <Check className="size-3.5" /> :
            null
          }
        >
          {phase === 'tapping' ? 'Verifying…' : phase === 'verified' ? 'Verified' : 'Tap your key (mock)'}
        </Button>
        {onSkip && (
          <Button size="sm" variant="ghost" onClick={onSkip}>
            Skip (dev only)
          </Button>
        )}
      </div>
    </div>
  );
}
