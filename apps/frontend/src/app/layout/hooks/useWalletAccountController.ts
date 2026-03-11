import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  getStoredTokens,
  getWalletBalance,
  requestWithdraw,
  updateProfile,
  type SessionUser,
} from '@features/auth/services/auth.service';

type UseWalletAccountControllerInput = {
  sessionUser: SessionUser | null;
  setSessionUser: (user: SessionUser | null) => void;
  setWalletBalance: Dispatch<SetStateAction<string | null>>;
  icCharacterName: string;
  profileImageDataUrl: string | null;
  setProfileImageDataUrl: Dispatch<SetStateAction<string | null>>;
  bankAccountId: string;
  setBankAccountId: Dispatch<SetStateAction<string>>;
};

export function useWalletAccountController(input: UseWalletAccountControllerInput) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawState, setWithdrawState] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);
  const [walletIbanVisible, setWalletIbanVisible] = useState(false);
  const [walletIbanEditing, setWalletIbanEditing] = useState(false);
  const [walletIbanState, setWalletIbanState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [walletIbanMessage, setWalletIbanMessage] = useState<string | null>(null);

  const handleProfileFileChange = async (file: File | null): Promise<void> => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : null;
      input.setProfileImageDataUrl(value);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (): Promise<void> => {
    const { accessToken } = getStoredTokens();
    if (!accessToken || !input.sessionUser) return;

    setSaveState('saving');
    try {
      const updated = await updateProfile(accessToken, {
        icCharacterName: input.icCharacterName,
        profileImageDataUrl: input.profileImageDataUrl ?? undefined,
        bankAccountId: input.bankAccountId,
      });
      input.setSessionUser(updated);
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1400);
    } catch {
      setSaveState('error');
    }
  };

  const handleWithdraw = async (): Promise<void> => {
    const { accessToken } = getStoredTokens();
    if (!accessToken || !input.sessionUser) return;

    if (!input.sessionUser.bankAccountId?.trim()) {
      setWithdrawState('error');
      setWithdrawMessage('Set your IBAN in Wallet before withdrawing.');
      setWalletIbanEditing(true);
      return;
    }

    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawState('error');
      setWithdrawMessage('Enter a valid amount');
      return;
    }

    setWithdrawState('submitting');
    setWithdrawMessage(null);
    try {
      const result = await requestWithdraw(accessToken, {
        amount,
      });

      if (result.status === 'accepted') {
        setWithdrawState('ok');
        setWithdrawMessage('Withdrawal request accepted');
        setWithdrawAmount('');
        const wallet = await getWalletBalance(accessToken);
        input.setWalletBalance(wallet.balance);
      } else {
        setWithdrawState('error');
        if (result.reason === 'missing_bank_account_id') {
          setWithdrawMessage('Set your IBAN in Wallet before withdrawing.');
          setWalletIbanEditing(true);
        } else if (result.reason === 'invalid_bank_account_id') {
          setWithdrawMessage('Your IBAN is invalid. Update it and try again.');
          setWalletIbanEditing(true);
        } else {
          setWithdrawMessage(result.reason ?? 'Withdrawal rejected');
        }
      }
    } catch {
      setWithdrawState('error');
      setWithdrawMessage('Withdrawal failed');
    }
  };

  const handleWalletIbanSave = async (): Promise<void> => {
    const { accessToken } = getStoredTokens();
    if (!accessToken || !input.sessionUser) return;

    const trimmed = input.bankAccountId.trim();
    if (!trimmed) {
      setWalletIbanState('error');
      setWalletIbanMessage('IBAN is required.');
      return;
    }

    if (!/^\d{4,20}$/.test(trimmed)) {
      setWalletIbanState('error');
      setWalletIbanMessage('IBAN must be 4-20 digits.');
      return;
    }

    setWalletIbanState('saving');
    setWalletIbanMessage(null);
    try {
      const updated = await updateProfile(accessToken, { bankAccountId: trimmed });
      input.setSessionUser(updated);
      input.setBankAccountId(updated.bankAccountId ?? '');
      setWalletIbanEditing(false);
      setWalletIbanState('saved');
      setWalletIbanMessage('IBAN updated');
      window.setTimeout(() => {
        setWalletIbanState('idle');
        setWalletIbanMessage(null);
      }, 1400);
    } catch {
      setWalletIbanState('error');
      setWalletIbanMessage('Could not update IBAN.');
    }
  };

  const startWalletIbanEditing = (): void => {
    input.setBankAccountId(input.sessionUser?.bankAccountId ?? '');
    setWalletIbanEditing(true);
    setWalletIbanMessage(null);
    setWalletIbanState('idle');
  };

  const handleWalletIbanCancel = (): void => {
    input.setBankAccountId(input.sessionUser?.bankAccountId ?? '');
    setWalletIbanEditing(false);
    setWalletIbanState('idle');
    setWalletIbanMessage(null);
  };

  return {
    saveState,
    withdrawAmount,
    setWithdrawAmount,
    withdrawState,
    withdrawMessage,
    walletIbanVisible,
    setWalletIbanVisible,
    walletIbanEditing,
    walletIbanState,
    walletIbanMessage,
    handleProfileFileChange,
    handleSaveProfile,
    handleWithdraw,
    handleWalletIbanSave,
    startWalletIbanEditing,
    handleWalletIbanCancel,
  };
}
