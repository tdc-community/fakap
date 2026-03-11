export type AppUserRole = 'user' | 'moderator' | 'admin';

export type AppUser = {
  id: string;
  discordId: string;
  username: string;
  avatarUrl: string | null;
  icCharacterName: string | null;
  profileImageUrl: string | null;
  bankAccountId: string | null;
  role: AppUserRole;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JwtClaims = {
  sub: string;
  discordId: string;
  role: AppUserRole;
  type: 'access' | 'refresh';
  exp?: number;
  iat?: number;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export type DiscordUserResponse = {
  id: string;
  username: string;
  avatar: string | null;
};
