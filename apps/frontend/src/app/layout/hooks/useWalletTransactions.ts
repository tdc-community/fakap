import { useEffect, useMemo, useState } from 'react';
import { getStoredTokens, type SessionUser } from '@features/auth/services/auth.service';
import { getWalletTransactions, type WalletTransaction } from '@features/wallet';

export type TxFilter = 'all' | 'success' | 'failed';

export function useWalletTransactions(input: {
  current: string;
  sessionUser: SessionUser | null;
}): {
  txFilter: TxFilter;
  setTxFilter: (filter: TxFilter) => void;
  txState: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  filteredTransactions: WalletTransaction[];
} {
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [txState, setTxState] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [txItems, setTxItems] = useState<WalletTransaction[]>([]);

  useEffect(() => {
    const run = async (): Promise<void> => {
      if (!input.sessionUser || input.current !== 'wallet') {
        return;
      }

      const { accessToken } = getStoredTokens();
      if (!accessToken) {
        setTxState('error');
        return;
      }

      setTxState('loading');
      try {
        const transactions = await getWalletTransactions({
          accountIdentifier: input.sessionUser.id,
          accessToken,
        });
        const sorted = [...transactions].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
        setTxItems(sorted);
        setTxState(sorted.length ? 'ready' : 'empty');
      } catch {
        setTxState('error');
      }
    };

    void run();
  }, [input.current, input.sessionUser]);

  const filteredTransactions = useMemo(() => {
    if (txFilter === 'all') return txItems;
    return txItems.filter((item: WalletTransaction) => item.status === txFilter);
  }, [txFilter, txItems]);

  return {
    txFilter,
    setTxFilter,
    txState,
    filteredTransactions,
  };
}
