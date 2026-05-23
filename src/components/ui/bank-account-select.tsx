import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type BankAccount = {
  id: string;
  accountNumber: string;
  ifsc: string;
  legalName: string;
  isDefault: boolean;
  verifiedAt: string | null;
};

type Props = {
  storeId: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

function mask(num: string): string {
  if (num.length <= 4) return num;
  return `${'•'.repeat(Math.max(0, num.length - 4))}${num.slice(-4)}`;
}

/**
 * Bank-account dropdown scoped to a store. Empty until storeId is set;
 * auto-selects the default account when one exists and the parent has no
 * selection yet.
 */
export function BankAccountSelect({ storeId, value, onChange, disabled }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stores', storeId, 'bank-accounts'],
    queryFn: () => api<BankAccount[]>(`/admin/stores/${storeId}/bank-accounts`),
    enabled: Boolean(storeId),
  });
  const accounts = data ?? [];

  useEffect(() => {
    if (value || accounts.length === 0) return;
    const def = accounts.find((a) => a.isDefault) ?? accounts[0];
    if (def) onChange(def.id);
  }, [value, accounts, onChange]);

  return (
    <Select value={value || ''} onValueChange={onChange} disabled={disabled || !storeId || isLoading}>
      <SelectTrigger>
        <SelectValue
          placeholder={
            !storeId
              ? 'Pick a store first'
              : isLoading
                ? 'Loading bank accounts…'
                : accounts.length === 0
                  ? 'No bank account on file'
                  : 'Pick an account'
          }
        />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            <div className="flex flex-col">
              <span className="text-[12.5px]">
                {a.legalName} · {mask(a.accountNumber)}
                {a.isDefault && <span className="ml-2 text-[10.5px] text-success">default</span>}
              </span>
              <span className="font-mono text-[11px] text-ink-4">{a.ifsc}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
