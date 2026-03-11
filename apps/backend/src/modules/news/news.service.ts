import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NewsRepository } from './news.repository';
import { NewsArticleRecord, NewsArticleStatus, NewsHomeSlot, NewsHomepagePayload } from './news.types';

@Injectable()
export class NewsService {
  constructor(
    private readonly newsRepository: NewsRepository,
    private readonly auditService: AuditService,
  ) {}

  async createArticle(input: {
    title: string;
    summary: string;
    content: string[];
    imageUrl: string;
    category: string;
    actorUserId: string;
  }): Promise<NewsArticleRecord> {
    const article = await this.newsRepository.createArticle(input);
    await this.auditService.log({
      actorUserId: input.actorUserId,
      action: 'news.article.created',
      targetType: 'news_article',
      targetId: article.id,
      payload: {
        slug: article.slug,
        status: article.status,
      },
    });
    return article;
  }

  async updateArticle(
    articleId: string,
    input: {
      title?: string;
      summary?: string;
      content?: string[];
      imageUrl?: string;
      category?: string;
      actorUserId: string;
    },
  ): Promise<NewsArticleRecord> {
    const article = await this.newsRepository.updateArticle(articleId, input);
    await this.auditService.log({
      actorUserId: input.actorUserId,
      action: 'news.article.updated',
      targetType: 'news_article',
      targetId: article.id,
      payload: {
        slug: article.slug,
      },
    });
    return article;
  }

  async setArticleStatus(articleId: string, status: NewsArticleStatus, actorUserId: string): Promise<NewsArticleRecord> {
    const article = await this.newsRepository.setArticleStatus(articleId, status, actorUserId);
    await this.auditService.log({
      actorUserId,
      action: 'news.article.status_changed',
      targetType: 'news_article',
      targetId: article.id,
      payload: {
        status,
      },
    });
    return article;
  }

  async deleteArticle(articleId: string, actorUserId: string): Promise<void> {
    await this.newsRepository.deleteArticle(articleId);
    await this.auditService.log({
      actorUserId,
      action: 'news.article.deleted',
      targetType: 'news_article',
      targetId: articleId,
      payload: {},
    });
  }

  async setHomeSlot(slot: NewsHomeSlot, articleId: string, actorUserId: string): Promise<{ slot: NewsHomeSlot; articleId: string }> {
    const updated = await this.newsRepository.setHomeSlot(slot, articleId, actorUserId);
    await this.auditService.log({
      actorUserId,
      action: 'news.home_slot.assigned',
      targetType: 'news_home_slot',
      targetId: slot,
      payload: {
        articleId: updated.articleId,
      },
    });
    return {
      slot: updated.slot,
      articleId: updated.articleId,
    };
  }

  async clearHomeSlot(slot: NewsHomeSlot, actorUserId: string): Promise<void> {
    await this.newsRepository.clearHomeSlot(slot);
    await this.auditService.log({
      actorUserId,
      action: 'news.home_slot.cleared',
      targetType: 'news_home_slot',
      targetId: slot,
      payload: {},
    });
  }

  async listArticles(params: {
    status?: NewsArticleStatus;
    search?: string;
    limit: number;
    offset: number;
    orderBy: 'created_at' | 'updated_at' | 'published_at' | 'title';
    order: 'asc' | 'desc';
  }): Promise<{ items: NewsArticleRecord[]; total: number }> {
    return this.newsRepository.listArticles(params);
  }

  async getHomepage(): Promise<NewsHomepagePayload> {
    return this.newsRepository.getHomepagePayload();
  }

  async getPublicArticleBySlug(slug: string): Promise<NewsArticleRecord> {
    const article = await this.newsRepository.getPublicArticleBySlug(slug);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  async getPublicArticleById(articleId: string): Promise<NewsArticleRecord> {
    const article = await this.newsRepository.getPublicArticleById(articleId);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }
}

