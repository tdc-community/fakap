import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  clearTokens,
  getMe,
  getStoredSessionUser,
  getStoredTokens,
  type SessionUser,
} from '../services/auth.service';

type SessionUserState = {
  sessionUser: SessionUser | null;
  authChecked: boolean;
};

type SessionUserActions = {
  setSessionUser: Dispatch<SetStateAction<SessionUser | null>>;
};

const SessionUserStateContext = createContext<SessionUserState | null>(null);
const SessionUserActionsContext = createContext<SessionUserActions | null>(null);

export function SessionUserProvider({ children }: { children: ReactNode }) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => getStoredSessionUser());
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const run = async (): Promise<void> => {
      const { accessToken } = getStoredTokens();
      if (!accessToken) {
        setSessionUser(null);
        setAuthChecked(true);
        return;
      }

      try {
        const me = await getMe(accessToken);
        setSessionUser(me);
      } catch {
        clearTokens();
        setSessionUser(null);
      } finally {
        setAuthChecked(true);
      }
    };

    void run();
  }, []);

  return (
    <SessionUserStateContext.Provider value={{ sessionUser, authChecked }}>
      <SessionUserActionsContext.Provider value={{ setSessionUser }}>{children}</SessionUserActionsContext.Provider>
    </SessionUserStateContext.Provider>
  );
}

export function useSessionUserState(): SessionUserState {
  const context = useContext(SessionUserStateContext);
  if (!context) {
    throw new Error('useSessionUserState must be used within SessionUserProvider');
  }

  return context;
}

export function useSessionUserActions(): SessionUserActions {
  const context = useContext(SessionUserActionsContext);
  if (!context) {
    throw new Error('useSessionUserActions must be used within SessionUserProvider');
  }

  return context;
}

export function useSessionUser(): SessionUserState & SessionUserActions {
  return {
    ...useSessionUserState(),
    ...useSessionUserActions(),
  };
}
