import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  getStoredTokens,
  getWalletBalance,
  type SessionUser,
} from '@features/auth/services/auth.service';

export function useAppLayoutSessionEffects(sessionUser: SessionUser | null): {
  walletBalance: string | null;
  setWalletBalance: Dispatch<SetStateAction<string | null>>;
  icCharacterName: string;
  setIcCharacterName: Dispatch<SetStateAction<string>>;
  profileImageDataUrl: string | null;
  setProfileImageDataUrl: Dispatch<SetStateAction<string | null>>;
  bankAccountId: string;
  setBankAccountId: Dispatch<SetStateAction<string>>;
} {
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [icCharacterName, setIcCharacterName] = useState('');
  const [profileImageDataUrl, setProfileImageDataUrl] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState('');

  useEffect(() => {
    const run = async (): Promise<void> => {
      if (!sessionUser) {
        setWalletBalance(null);
        return;
      }

      const { accessToken } = getStoredTokens();
      if (!accessToken) {
        setWalletBalance(null);
        return;
      }

      try {
        const wallet = await getWalletBalance(accessToken);
        setWalletBalance(wallet.balance);
      } catch {
        setWalletBalance(null);
      }
    };

    void run();
  }, [sessionUser]);

  useEffect(() => {
    setIcCharacterName(sessionUser?.icCharacterName ?? '');
    setProfileImageDataUrl(sessionUser?.profileImageUrl ?? null);
    setBankAccountId(sessionUser?.bankAccountId ?? '');
  }, [sessionUser]);

  return {
    walletBalance,
    setWalletBalance,
    icCharacterName,
    setIcCharacterName,
    profileImageDataUrl,
    setProfileImageDataUrl,
    bankAccountId,
    setBankAccountId,
  };
}
