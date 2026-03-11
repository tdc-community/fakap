import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

type VehiclePostRow = {
  id: string;
  title: string;
  description: string;
  image_urls: string[];
  author_name: string;
  created_at: Date;
  upvotes: string;
  downvotes: string;
  viewer_vote: number;
};

export type VehiclePostRecord = {
  id: string;
  title: string;
  description: string;
  imageUrls: string[];
  authorName: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  viewerVote: -1 | 0 | 1;
};

@Injectable()
export class VehiclesRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async ensureTables(): Promise<void> {
    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS vehicle_posts (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        image_urls JSONB NOT NULL,
        author_user_id UUID NULL,
        author_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS vehicle_votes (
        post_id UUID NOT NULL REFERENCES vehicle_posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (post_id, user_id)
      )
    `);

    await this.databaseService.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_vehicle_posts_created_at ON vehicle_posts(created_at DESC)',
    );
    await this.databaseService.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_vehicle_votes_post_id ON vehicle_votes(post_id)',
    );
  }

  async listPosts(viewerUserId?: string): Promise<VehiclePostRecord[]> {
    const { rows } = await this.databaseService.pool.query<VehiclePostRow>(
      `
      SELECT
        vp.id,
        vp.title,
        vp.description,
        vp.image_urls,
        vp.author_name,
        vp.created_at,
        COALESCE(SUM(CASE WHEN vv.vote = 1 THEN 1 ELSE 0 END), 0)::text AS upvotes,
        COALESCE(SUM(CASE WHEN vv.vote = -1 THEN 1 ELSE 0 END), 0)::text AS downvotes,
        COALESCE(MAX(CASE WHEN vv.user_id = $1 THEN vv.vote ELSE 0 END), 0) AS viewer_vote
      FROM vehicle_posts vp
      LEFT JOIN vehicle_votes vv ON vv.post_id = vp.id
      GROUP BY vp.id
      ORDER BY (COALESCE(SUM(vv.vote), 0)) DESC, vp.created_at DESC, vp.id ASC
      `,
      [viewerUserId ?? ''],
    );

    return rows.map((row) => this.mapPost(row));
  }

  async createPost(input: {
    title: string;
    description: string;
    imageUrls: string[];
    authorUserId?: string;
    authorName: string;
  }): Promise<VehiclePostRecord> {
    const id = randomUUID();
    const now = new Date();

    await this.databaseService.pool.query(
      `
      INSERT INTO vehicle_posts (id, title, description, image_urls, author_user_id, author_name, created_at)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
      `,
      [id, input.title, input.description, JSON.stringify(input.imageUrls), input.authorUserId ?? null, input.authorName, now],
    );

    if (input.authorUserId) {
      await this.databaseService.pool.query(
        `
        INSERT INTO vehicle_votes (post_id, user_id, vote, updated_at)
        VALUES ($1, $2, 1, NOW())
        `,
        [id, input.authorUserId],
      );
    }

    const posts = await this.listPosts(input.authorUserId);
    const created = posts.find((post) => post.id === id);
    if (!created) {
      throw new Error('Created vehicle post not found');
    }
    return created;
  }

  async votePost(input: { postId: string; userId: string; vote: -1 | 0 | 1 }): Promise<VehiclePostRecord> {
    if (input.vote === 0) {
      await this.databaseService.pool.query(
        `
        DELETE FROM vehicle_votes
        WHERE post_id = $1 AND user_id = $2
        `,
        [input.postId, input.userId],
      );
    } else {
      await this.databaseService.pool.query(
        `
        INSERT INTO vehicle_votes (post_id, user_id, vote, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (post_id, user_id)
        DO UPDATE SET vote = EXCLUDED.vote, updated_at = NOW()
        `,
        [input.postId, input.userId, input.vote],
      );
    }

    const posts = await this.listPosts(input.userId);
    const updated = posts.find((post) => post.id === input.postId);
    if (!updated) {
      throw new Error('Vehicle post not found');
    }
    return updated;
  }

  async deletePost(postId: string): Promise<void> {
    const result = await this.databaseService.pool.query(
      `
      DELETE FROM vehicle_posts
      WHERE id = $1
      `,
      [postId],
    );

    if (result.rowCount === 0) {
      throw new Error('Vehicle post not found');
    }
  }

  private mapPost(row: VehiclePostRow): VehiclePostRecord {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrls: row.image_urls,
      authorName: row.author_name,
      createdAt: row.created_at.toISOString(),
      upvotes: Number(row.upvotes),
      downvotes: Number(row.downvotes),
      viewerVote: (row.viewer_vote === 1 || row.viewer_vote === -1 ? row.viewer_vote : 0) as -1 | 0 | 1,
    };
  }
}
