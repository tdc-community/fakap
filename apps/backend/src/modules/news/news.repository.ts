import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { NewsArticleRecord, NewsArticleStatus, NewsHomeSlot, NewsHomepagePayload, NewsSlotRecord } from './news.types';

type NewsArticleRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string[];
  image_url: string;
  category: string;
  status: NewsArticleStatus;
  published_at: Date | null;
  created_by: string;
  updated_by: string;
  created_at: Date;
  updated_at: Date;
};

type NewsSlotRow = {
  slot: NewsHomeSlot;
  article_id: string;
  updated_by: string;
  updated_at: Date;
};

@Injectable()
export class NewsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createArticle(input: {
    title: string;
    summary: string;
    content: string[];
    imageUrl: string;
    category: string;
    actorUserId: string;
  }): Promise<NewsArticleRecord> {
    const id = randomUUID();
    const now = new Date();
    const slug = await this.generateUniqueSlug(input.title);

    const result = await this.databaseService.pool.query<NewsArticleRow>(
      `
      INSERT INTO news_articles (
        id, slug, title, summary, content, image_url, category,
        status, published_at, created_by, updated_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, 'draft', NULL, $8, $8, $9, $9)
      RETURNING
        id, slug, title, summary, content, image_url, category,
        status, published_at, created_by, updated_by, created_at, updated_at
      `,
      [id, slug, input.title, input.summary, JSON.stringify(input.content), input.imageUrl, input.category, input.actorUserId, now],
    );

    return this.mapArticle(result.rows[0]);
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
    const existing = await this.findArticleById(articleId);
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    const title = input.title ?? existing.title;
    const summary = input.summary ?? existing.summary;
    const content = input.content ?? existing.content;
    const imageUrl = input.imageUrl ?? existing.imageUrl;
    const category = input.category ?? existing.category;
    const slug = input.title ? await this.generateUniqueSlug(input.title, articleId) : existing.slug;

    const result = await this.databaseService.pool.query<NewsArticleRow>(
      `
      UPDATE news_articles
      SET slug = $2,
          title = $3,
          summary = $4,
          content = $5::jsonb,
          image_url = $6,
          category = $7,
          updated_by = $8,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id, slug, title, summary, content, image_url, category,
        status, published_at, created_by, updated_by, created_at, updated_at
      `,
      [articleId, slug, title, summary, JSON.stringify(content), imageUrl, category, input.actorUserId],
    );

    return this.mapArticle(result.rows[0]);
  }

  async setArticleStatus(articleId: string, status: NewsArticleStatus, actorUserId: string): Promise<NewsArticleRecord> {
    const existing = await this.findArticleById(articleId);
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    const publishedAt = status === 'published' ? existing.publishedAt ?? new Date().toISOString() : null;

    const client = await this.databaseService.pool.connect();
    try {
      await client.query('BEGIN');

      const updateResult = await client.query<NewsArticleRow>(
        `
        UPDATE news_articles
        SET status = $2,
            published_at = $3,
            updated_by = $4,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id, slug, title, summary, content, image_url, category,
          status, published_at, created_by, updated_by, created_at, updated_at
        `,
        [articleId, status, publishedAt, actorUserId],
      );

      if (status === 'draft') {
        await client.query(
          `
          DELETE FROM news_home_slots
          WHERE article_id = $1
          `,
          [articleId],
        );
      }

      await client.query('COMMIT');
      return this.mapArticle(updateResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteArticle(articleId: string): Promise<void> {
    const result = await this.databaseService.pool.query(
      `
      DELETE FROM news_articles
      WHERE id = $1
      `,
      [articleId],
    );

    if (!result.rowCount) {
      throw new NotFoundException('Article not found');
    }
  }

  async setHomeSlot(slot: NewsHomeSlot, articleId: string, actorUserId: string): Promise<NewsSlotRecord> {
    const article = await this.findArticleById(articleId);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    if (article.status !== 'published') {
      throw new BadRequestException('Only published articles can be assigned to homepage slots');
    }

    const client = await this.databaseService.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        DELETE FROM news_home_slots
        WHERE article_id = $1
        `,
        [articleId],
      );

      const upsertResult = await client.query<NewsSlotRow>(
        `
        INSERT INTO news_home_slots (slot, article_id, updated_by, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (slot)
        DO UPDATE SET article_id = EXCLUDED.article_id, updated_by = EXCLUDED.updated_by, updated_at = NOW()
        RETURNING slot, article_id, updated_by, updated_at
        `,
        [slot, articleId, actorUserId],
      );

      await client.query('COMMIT');
      return this.mapSlot(upsertResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async clearHomeSlot(slot: NewsHomeSlot): Promise<void> {
    await this.databaseService.pool.query(
      `
      DELETE FROM news_home_slots
      WHERE slot = $1
      `,
      [slot],
    );
  }

  async getHomepagePayload(): Promise<NewsHomepagePayload> {
    const slots = await this.databaseService.pool.query<NewsSlotRow>(
      `
      SELECT slot, article_id, updated_by, updated_at
      FROM news_home_slots
      `,
    );

    const articleIds = slots.rows.map((row: NewsSlotRow) => row.article_id);
    if (articleIds.length === 0) {
      return { primary: null, secondary: null, third: null };
    }

    const articlesResult = await this.databaseService.pool.query<NewsArticleRow>(
      `
      SELECT
        id, slug, title, summary, content, image_url, category,
        status, published_at, created_by, updated_by, created_at, updated_at
      FROM news_articles
      WHERE id = ANY($1::uuid[])
        AND status = 'published'
      `,
      [articleIds],
    );

    const articleMap = new Map<string, NewsArticleRecord>(
      articlesResult.rows.map((row: NewsArticleRow) => [row.id, this.mapArticle(row)]),
    );

    const output: NewsHomepagePayload = {
      primary: null,
      secondary: null,
      third: null,
    };

    for (const slotRow of slots.rows as NewsSlotRow[]) {
      const article = articleMap.get(slotRow.article_id);
      if (!article) {
        continue;
      }

      if (slotRow.slot === 'primary') output.primary = article;
      if (slotRow.slot === 'secondary') output.secondary = article;
      if (slotRow.slot === 'third') output.third = article;
    }

    return output;
  }

  async listArticles(params: {
    status?: NewsArticleStatus;
    search?: string;
    limit: number;
    offset: number;
    orderBy: 'created_at' | 'updated_at' | 'published_at' | 'title';
    order: 'asc' | 'desc';
  }): Promise<{ items: NewsArticleRecord[]; total: number }> {
    const whereParts: string[] = [];
    const values: Array<string | number> = [];

    if (params.status) {
      values.push(params.status);
      whereParts.push(`status = $${values.length}`);
    }

    if (params.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      whereParts.push(`(title ILIKE $${values.length} OR summary ILIKE $${values.length} OR category ILIKE $${values.length})`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const orderByColumn = params.orderBy;
    const orderDirection = params.order;

    values.push(params.limit);
    const limitPos = values.length;
    values.push(params.offset);
    const offsetPos = values.length;

    const [itemsResult, countResult] = await Promise.all([
      this.databaseService.pool.query<NewsArticleRow>(
        `
        SELECT
          id, slug, title, summary, content, image_url, category,
          status, published_at, created_by, updated_by, created_at, updated_at
        FROM news_articles
        ${whereSql}
        ORDER BY ${orderByColumn} ${orderDirection}, id ASC
        LIMIT $${limitPos}
        OFFSET $${offsetPos}
        `,
        values,
      ),
      this.databaseService.pool.query<{ total: string }>(
        `
        SELECT COUNT(*)::text AS total
        FROM news_articles
        ${whereSql}
        `,
        values.slice(0, values.length - 2),
      ),
    ]);

    return {
      items: itemsResult.rows.map((row: NewsArticleRow) => this.mapArticle(row)),
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async getPublicArticleBySlug(slug: string): Promise<NewsArticleRecord | null> {
    const result = await this.databaseService.pool.query<NewsArticleRow>(
      `
      SELECT
        id, slug, title, summary, content, image_url, category,
        status, published_at, created_by, updated_by, created_at, updated_at
      FROM news_articles
      WHERE slug = $1
        AND status = 'published'
      LIMIT 1
      `,
      [slug],
    );

    if (!result.rowCount) {
      return null;
    }

    return this.mapArticle(result.rows[0]);
  }

  async getPublicArticleById(articleId: string): Promise<NewsArticleRecord | null> {
    const result = await this.databaseService.pool.query<NewsArticleRow>(
      `
      SELECT
        id, slug, title, summary, content, image_url, category,
        status, published_at, created_by, updated_by, created_at, updated_at
      FROM news_articles
      WHERE id = $1
        AND status = 'published'
      LIMIT 1
      `,
      [articleId],
    );

    if (!result.rowCount) {
      return null;
    }

    return this.mapArticle(result.rows[0]);
  }

  async findArticleById(articleId: string): Promise<NewsArticleRecord | null> {
    const result = await this.databaseService.pool.query<NewsArticleRow>(
      `
      SELECT
        id, slug, title, summary, content, image_url, category,
        status, published_at, created_by, updated_by, created_at, updated_at
      FROM news_articles
      WHERE id = $1
      LIMIT 1
      `,
      [articleId],
    );

    if (!result.rowCount) {
      return null;
    }

    return this.mapArticle(result.rows[0]);
  }

  private async generateUniqueSlug(title: string, excludeArticleId?: string): Promise<string> {
    const base = this.slugify(title);
    let attempt = 0;

    while (attempt < 1000) {
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;

      const values: string[] = [slug];
      let sql = `SELECT id FROM news_articles WHERE slug = $1`;
      if (excludeArticleId) {
        values.push(excludeArticleId);
        sql += ` AND id <> $2`;
      }
      sql += ` LIMIT 1`;

      const result = await this.databaseService.pool.query<{ id: string }>(sql, values);
      if (!result.rowCount) {
        return slug;
      }

      attempt += 1;
    }

    return `${base}-${randomUUID().slice(0, 8)}`;
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    return slug || `article-${Date.now()}`;
  }

  private mapArticle(row: NewsArticleRow): NewsArticleRecord {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      content: row.content,
      imageUrl: row.image_url,
      category: row.category,
      status: row.status,
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapSlot(row: NewsSlotRow): NewsSlotRecord {
    return {
      slot: row.slot,
      articleId: row.article_id,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
