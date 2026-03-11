export type UserRole = 'user' | 'moderator' | 'admin';

export type WalletBalance = {
  available: string;
  held: string;
  currency: 'USD';
};

export type AuctionStatus = 'draft' | 'active' | 'ended' | 'settled' | 'cancelled';

