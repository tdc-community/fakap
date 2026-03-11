import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NewsRepository } from './news.repository';

describe('NewsRepository (logic-level)', () => {
  function makeRepo(overrides?: {
    findArticleById?: jest.Mock;
    setHomeSlot?: jest.Mock;
  }): NewsRepository {
    const db = {
      pool: {
        query: jest.fn(),
        connect: jest.fn(),
      },
    } as any;

    const repo = new NewsRepository(db);
    if (overrides?.findArticleById) {
      (repo as any).findArticleById = overrides.findArticleById;
    }
    if (overrides?.setHomeSlot) {
      (repo as any).setHomeSlot = overrides.setHomeSlot;
    }
    return repo;
  }

  it('rejects slot assignment for unknown article', async () => {
    const repo = makeRepo({
      findArticleById: jest.fn().mockResolvedValue(null),
    });

    await expect(repo.setHomeSlot('primary', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects slot assignment for draft article', async () => {
    const repo = makeRepo({
      findArticleById: jest.fn().mockResolvedValue({
        id: 'a',
        slug: 'a',
        title: 'a',
        summary: 'a',
        content: ['a'],
        imageUrl: 'a',
        category: 'a',
        status: 'draft',
        publishedAt: null,
        createdBy: 'u',
        updatedBy: 'u',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });

    await expect(repo.setHomeSlot('primary', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

