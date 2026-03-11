import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { BearerAuthGuard } from '../auth/bearer-auth.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateVehiclePostDto } from './dto/create-vehicle-post.dto';
import { VoteVehiclePostDto } from './dto/vote-vehicle-post.dto';
import { VehiclePostRecord } from './vehicles.repository';
import { VehiclesService } from './vehicles.service';

type AuthedRequest = Request & {
  auth?: {
    userId: string;
    role?: 'user' | 'moderator' | 'admin';
  };
};

@Controller('vehicles')
export class VehiclesController {
  private readonly updates$ = new Subject<{ type: 'created' | 'voted'; post: VehiclePostRecord }>();

  constructor(private readonly vehiclesService: VehiclesService) {
    void this.vehiclesService.ensureTables();
  }

  @UseGuards(BearerAuthGuard)
  @Get('posts')
  async listPosts(@Req() req: AuthedRequest): Promise<{ posts: VehiclePostRecord[] }> {
    const userId = req.auth?.userId;
    if (!userId) throw new UnauthorizedException('Missing principal');
    return { posts: await this.vehiclesService.listPosts(userId) };
  }

  @UseGuards(BearerAuthGuard)
  @Post('posts')
  async createPost(@Req() req: AuthedRequest, @Body() dto: CreateVehiclePostDto): Promise<{ post: VehiclePostRecord }> {
    const userId = req.auth?.userId;
    if (!userId) throw new UnauthorizedException('Missing principal');

    const post = await this.vehiclesService.createPost({
      title: dto.title,
      description: dto.description,
      imageUrls: dto.imageUrls,
      authorUserId: userId,
      authorName: `User-${userId.slice(0, 6)}`,
    });

    this.updates$.next({ type: 'created', post });
    return { post };
  }

  @UseGuards(BearerAuthGuard)
  @Post('posts/:postId/vote')
  async votePost(
    @Req() req: AuthedRequest,
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @Body() dto: VoteVehiclePostDto,
  ): Promise<{ post: VehiclePostRecord }> {
    const userId = req.auth?.userId;
    if (!userId) throw new UnauthorizedException('Missing principal');

    const post = await this.vehiclesService.votePost({
      postId,
      userId,
      vote: dto.vote,
    });

    this.updates$.next({ type: 'voted', post });
    return { post };
  }

  @UseGuards(BearerAuthGuard, RolesGuard)
  @RequireRoles('moderator', 'admin')
  @Delete('posts/:postId')
  async deletePost(@Param('postId', new ParseUUIDPipe()) postId: string): Promise<{ ok: true }> {
    await this.vehiclesService.deletePost(postId);
    return { ok: true };
  }

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.updates$.pipe(map((event) => ({ data: event } as MessageEvent)));
  }
}
