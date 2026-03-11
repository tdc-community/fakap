export type NewsArticleStatus = 'draft' | 'published';
export type NewsHomeSlot = 'primary' | 'secondary' | 'third';

export type NewsArticleRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string[];
  imageUrl: string;
  category: string;
  status: NewsArticleStatus;
  publishedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type NewsSlotRecord = {
  slot: NewsHomeSlot;
  articleId: string;
  updatedBy: string;
  updatedAt: string;
};

export type NewsHomepagePayload = {
  primary: NewsArticleRecord | null;
  secondary: NewsArticleRecord | null;
  third: NewsArticleRecord | null;
};

