export type AppRole = 'user' | 'moderator' | 'admin';

export type SessionUser = {
  id: string;
  username: string;
  discordId: string;
  role: AppRole;
  avatarUrl: string | null;
  icCharacterName: string | null;
  profileImageUrl: string | null;
  bankAccountId: string | null;
};

export type SessionState = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  returnTo: string | null;
};

const ACCESS_KEY = 'fakap_access_token';
const REFRESH_KEY = 'fakap_refresh_token';
const USER_KEY = 'fakap_session_user';
const AUTH_RETURN_TO_KEY = 'fakap_auth_return_to';
const AUTH_OAUTH_STATE_KEY = 'fakap_auth_oauth_state';
const CALLBACK_PATH = '/auth/callback';

export function getApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  const normalized = configured.replace(/\/$/, '');

  try {
    const url = new URL(normalized);
    const hasExplicitPath = url.pathname !== '' && url.pathname !== '/';
    const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    if (!hasExplicitPath && !isLocalHost) {
      return `${normalized}/api`;
    }
  } catch {
    // keep configured value for non-URL inputs
  }

  return normalized;
}

export function getStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: localStorage.getItem(ACCESS_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
  };
}

export function storeTokens(tokens: { accessToken: string; refreshToken: string }): void {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredSessionUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function storeSessionUser(user: SessionUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getDiscordLoginUrl(state?: string): Promise<string> {
  const url = new URL(`${getApiBase()}/auth/discord/login`);
  if (state) {
    url.searchParams.set('state', state);
  }

  return url.toString();
}

export function getCurrentRelativeLocation(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function sanitizeReturnTarget(target?: string | null): string | null {
  if (!target) return null;
  const value = target.trim();
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://')) return null;
  if (value.startsWith(CALLBACK_PATH)) return null;
  return value;
}

export function setAuthReturnTarget(target?: string | null): string | null {
  const sanitized = sanitizeReturnTarget(target);
  if (!sanitized) {
    sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
    return null;
  }

  sessionStorage.setItem(AUTH_RETURN_TO_KEY, sanitized);
  return sanitized;
}

export function getAuthReturnTarget(): string | null {
  const value = sessionStorage.getItem(AUTH_RETURN_TO_KEY);
  return sanitizeReturnTarget(value);
}

export function clearAuthReturnTarget(): void {
  sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
}

function encodeOAuthState(payload: { nonce: string; returnTo: string }): string {
  const raw = JSON.stringify(payload);
  return btoa(encodeURIComponent(raw));
}

function decodeOAuthState(value: string): { nonce: string; returnTo?: string } | null {
  try {
    const decoded = decodeURIComponent(atob(value));
    const parsed = JSON.parse(decoded) as { nonce?: string; returnTo?: string };
    if (!parsed.nonce || typeof parsed.nonce !== 'string') {
      return null;
    }

    return {
      nonce: parsed.nonce,
      returnTo: parsed.returnTo,
    };
  } catch {
    return null;
  }
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${Date.now().toString(36)}-${random}`;
}

export async function beginDiscordLoginRedirect(input?: { returnTo?: string | null }): Promise<void> {
  const requestedReturnTo = sanitizeReturnTarget(input?.returnTo ?? getCurrentRelativeLocation());
  const persistedReturnTo = getAuthReturnTarget();
  const effectiveReturnTo = requestedReturnTo ?? persistedReturnTo ?? '/';
  setAuthReturnTarget(effectiveReturnTo);
  const nonce = createNonce();
  const oauthState = encodeOAuthState({ nonce, returnTo: effectiveReturnTo });

  sessionStorage.setItem(AUTH_OAUTH_STATE_KEY, nonce);
  const url = await getDiscordLoginUrl(oauthState);
  window.location.assign(url);
}

function resolveAuthReturnTarget(state?: string | null): string | null {
  const fallback = getAuthReturnTarget();
  const expectedNonce = sessionStorage.getItem(AUTH_OAUTH_STATE_KEY);

  if (!state) {
    return fallback;
  }

  const decoded = decodeOAuthState(state);
  if (!decoded) {
    return fallback;
  }

  if (expectedNonce && decoded.nonce !== expectedNonce) {
    return fallback;
  }

  return sanitizeReturnTarget(decoded.returnTo) ?? fallback;
}

function clearAuthRedirectContext(): void {
  sessionStorage.removeItem(AUTH_OAUTH_STATE_KEY);
  clearAuthReturnTarget();
}

export async function completeDiscordCallback(input?: { state?: string | null }): Promise<SessionState> {
  const params = new URLSearchParams(window.location.search);
  const state = input?.state ?? params.get('state');
  const authCode = params.get('authCode');
  const returnTo = resolveAuthReturnTarget(state);

  if (authCode) {
    try {
      const exchangeResponse = await fetch(`${getApiBase()}/auth/exchange-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authCode }),
      });

      if (!exchangeResponse.ok) {
        throw new Error('Auth code exchange failed');
      }

      const exchanged = (await exchangeResponse.json()) as {
        accessToken: string;
        refreshToken: string;
        user: SessionUser;
      };

      storeTokens({
        accessToken: exchanged.accessToken,
        refreshToken: exchanged.refreshToken,
      });
      storeSessionUser(exchanged.user);

      return {
        accessToken: exchanged.accessToken,
        refreshToken: exchanged.refreshToken,
        user: exchanged.user,
        returnTo,
      };
    } finally {
      clearAuthRedirectContext();
    }
  }

  throw new Error('Missing auth callback payload');
}

export async function getMe(accessToken: string): Promise<SessionUser> {
  const response = await fetch(`${getApiBase()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error('Session invalid');
  }
  const data = (await response.json()) as { user: SessionUser };
  storeSessionUser(data.user);
  return data.user;
}

export async function logout(accessToken: string, refreshToken: string): Promise<void> {
  await fetch(`${getApiBase()}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function getWalletBalance(accessToken: string): Promise<{ accountIdentifier: string; balance: string }> {
  const response = await fetch(`${getApiBase()}/wallet/balance`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Could not load wallet balance');
  }
  return (await response.json()) as { accountIdentifier: string; balance: string };
}

export async function updateProfile(
  accessToken: string,
  payload: { icCharacterName?: string; profileImageDataUrl?: string; bankAccountId?: string },
): Promise<SessionUser> {
  const response = await fetch(`${getApiBase()}/auth/profile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Profile update failed');
  }

  const data = (await response.json()) as { user: SessionUser };
  return data.user;
}

export async function requestWithdraw(
  accessToken: string,
  payload: { amount: number },
): Promise<{
  accountIdentifier: string;
  amount: number;
  status: 'accepted' | 'rejected';
  reason?: string;
  newBalance?: string;
}> {
  const response = await fetch(`${getApiBase()}/wallet/withdraw`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Withdraw request failed');
  }

  return (await response.json()) as {
    accountIdentifier: string;
    amount: number;
    status: 'accepted' | 'rejected';
    reason?: string;
    newBalance?: string;
  };
}
