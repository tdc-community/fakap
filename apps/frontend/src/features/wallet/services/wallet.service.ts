import { getApiBase } from '@features/auth';

export type WalletTxStatus = 'success' | 'failed';
export type WalletTxDirection = 'send' | 'receive';

export type WalletTransaction = {
  id: string;
  hash: string;
  amount: number;
  asset: string;
  timestamp: string;
  direction: WalletTxDirection;
  networkFee?: number;
  status: WalletTxStatus;
};

export async function getWalletTransactions(input: {
  accessToken: string;
}): Promise<WalletTransaction[]> {
  const response = await fetch(`${getApiBase()}/wallet/transactions`, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Could not load wallet transactions');
  }

  const data = (await response.json()) as {
    transactions: Array<{
      id: string;
      hash: string;
      amount: number;
      asset: 'USD';
      timestamp: string;
      direction: 'send' | 'receive';
      status: 'success' | 'failed';
    }>;
  };

  return [...data.transactions].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
