import { getApiBase } from '@features/auth';
import type { NewsArticle } from '@features/news/types';

type PublicHomepageResponse = {
  primary: NewsArticle | null;
  secondary: NewsArticle | null;
  third: NewsArticle | null;
};

type PublicArticleResponse = {
  article: NewsArticle;
};

export async function getNewsHomepage(): Promise<{
  hero: NewsArticle;
  featured: NewsArticle[];
  list: NewsArticle[];
}> {
  const response = await fetch(`${getApiBase()}/news/public/home`);
  if (!response.ok) {
    throw new Error('Could not load homepage news');
  }

  const data = (await response.json()) as PublicHomepageResponse;
  if (!data.primary) {
    throw new Error('Primary homepage slot is not configured');
  }

  return {
    hero: data.primary,
    featured: [data.secondary, data.third].filter((article): article is NewsArticle => article !== null),
    list: [],
  };
}

export async function getNewsArticleById(articleId: string): Promise<NewsArticle | null> {
  const response = await fetch(`${getApiBase()}/news/public/articles/${encodeURIComponent(articleId)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Could not load article');
  }

  const data = (await response.json()) as PublicArticleResponse;
  return data.article;
}
