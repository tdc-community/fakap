import { useState } from 'react';
import {
  beginDiscordLoginRedirect,
  clearTokens,
  getStoredTokens,
  logout,
  type SessionUser,
} from '@features/auth/services/auth.service';

type UseAccountMenuControllerInput = {
  setSessionUser: (user: SessionUser | null) => void;
  setWalletBalance: (balance: string | null) => void;
};

export function useAccountMenuController(input: UseAccountMenuControllerInput): {
  busy: boolean;
  accountOpen: boolean;
  setAccountOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
} {
  const [busy, setBusy] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const handleLogin = async (): Promise<void> => {
    setBusy(true);
    try {
      await beginDiscordLoginRedirect();
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    const { accessToken, refreshToken } = getStoredTokens();
    if (!accessToken || !refreshToken) return;

    setBusy(true);
    try {
      await logout(accessToken, refreshToken);
    } finally {
      clearTokens();
      input.setSessionUser(null);
      input.setWalletBalance(null);
      setAccountOpen(false);
      setBusy(false);
    }
  };

  return {
    busy,
    accountOpen,
    setAccountOpen,
    handleLogin,
    handleLogout,
  };
}
