import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { BearerAuthGuard } from '../auth/bearer-auth.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AppUserRole } from '../auth/types';
import { CreateNewsArticleDto } from './dto/create-news-article.dto';
import { SetNewsStatusDto } from './dto/set-news-status.dto';
import { UpdateNewsArticleDto } from './dto/update-news-article.dto';
import { ListNewsArticlesQueryDto } from './dto/list-news-articles-query.dto';
import { NewsService } from './news.service';
import { NewsArticleStatus, NewsHomeSlot } from './news.types';

type AuthedRequest = Request & {
  auth?: {
    userId: string;
    role: AppUserRole;
  };
};

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  private parseSlot(slot: string): NewsHomeSlot {
    if (slot === 'primary' || slot === 'secondary' || slot === 'third') {
      return slot;
    }
    throw new BadRequestException('Invalid slot');
  }

  @UseGuards(BearerAuthGuard, RolesGuard)
  @RequireRoles('moderator', 'admin')
  @Post('admin/articles')
  async createArticle(@Req() req: AuthedRequest, @Body() dto: CreateNewsArticleDto) {
    const userId = req.auth?.userId;
    if (!userId) throw new UnauthorizedException('Missing principal');

    const article = await this.newsService.createArticle({
      title: dto.title,
      summary: dto.summary,
      content: dto.content,
      imageUrl: dto.imageUrl,
      category: dto.category,
      actorUserId: userId,
    });
    return { article };
  }

  @UseGuards(BearerAuthGuard, RolesGuard)
  @RequireRoles('moderator', 'admin')
  @Patch('admin/articles/:articleId')
  async updateArticle(
    @Req() req: AuthedRequest,
    @Param('articleId', new ParseUUIDPipe()) articleId: string,
    @Body() dto: UpdateNewsArticleDto,
  ) {
    const userId = req.auth?.userId;
    if (!userId) throw new UnauthorizedException('Missing principal');

    const article = await this.newsService.updateArticle(articleId, {
      title: dto.title,
      summary: dto.summary,
      content: dto.content,
      imageUrl: dto.imageUrl,
      category: dto.category,
      actorUserId: userId,
    });

    return { article };
  }

  @UseGuards(BearerAuthGuard, RolesGuard)
  @RequireRoles('moderator', 'admin')
  @Patch('admin/articles/:articleId/status')
  async setArticleStatus(
    @Req() req: AuthedRequest,
    @Param('articleId', new ParseUUIDPipe()) articleId: string,
    @Body() dto: SetNewsStatusDto,
  ) {
    const userId = req.auth?.userId;
    if (!userId) throw new UnauthorizedException('Missing principal');

    const article = await this.newsService.setArticleStatus(articleId, dto.status, userId);
    return { article };
  }

  @UseGuards(BearerAuthGuard, RolesGuard)
  @RequireRoles('moderator', 'admin')
  @Delete('admin/articles/:articleId')
  async deleteArticle(@Req() req: AuthedRequest, @Param('articleId', new ParseUUIDPipe()) articleId: string) {
    const userId = req.auth?.userId;
    if (!userId) throw new UnauthorizedException('Missing principal');

    await this.newsService.deleteArticle(articleId, userId);
    return { ok: true } as const;
  }

  @UseGuards(BearerAuthGuard, RolesGuard)
  @RequireRoles('moderator', 'admin')
  @Post('admin/home-slots/:slot/:articleId')
  async setHomeSlot(
    @Req() req: AuthedRequest,
    @Param('slot') slotValue: string,
    @Param('articleId', new ParseUUIDPipe()) articleId: string,
  ) {
    const userId = req.auth?.userId;
    if (!userId) throw new UnauthorizedException('Missing principal');

    const slot = this.parseSlot(slotValue);
    const assignment = await this.newsService.setHomeSlot(slot, articleId, userId);
    return { assignment };
  }

  @UseGuards(BearerAuthGuard, RolesGuard)
  @RequireRoles('moderator', 'admin')
  @Delete('admin/home-slots/:slot')
  async clearHomeSlot(@Req() req: AuthedRequest, @Param('slot') slotValue: string) {
    const userId = req.auth?.userId;
    if (!userId) throw new UnauthorizedException('Missing principal');

    const slot = this.parseSlot(slotValue);
    await this.newsService.clearHomeSlot(slot, userId);
    return { ok: true } as const;
  }

  @UseGuards(BearerAuthGuard, RolesGuard)
  @RequireRoles('moderator', 'admin')
  @Get('admin/articles')
  async listArticles(@Query() query: ListNewsArticlesQueryDto) {
    const data = await this.newsService.listArticles({
      status: query.status,
      search: query.search,
      limit: Math.min(query.limit ?? 20, 100),
      offset: query.offset ?? 0,
      orderBy: query.orderBy ?? 'updated_at',
      order: query.order ?? 'desc',
    });
    return data;
  }

  @Get('public/home')
  async publicHome() {
    return this.newsService.getHomepage();
  }

  @Get('public/articles/slug/:slug')
  async publicArticleBySlug(@Param('slug') slug: string) {
    return { article: await this.newsService.getPublicArticleBySlug(slug) };
  }

  @Get('public/articles/:articleId')
  async publicArticleById(@Param('articleId', new ParseUUIDPipe()) articleId: string) {
    return { article: await this.newsService.getPublicArticleById(articleId) };
  }
}
