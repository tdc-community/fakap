import { Injectable } from '@nestjs/common';
import { VehiclePostRecord, VehiclesRepository } from './vehicles.repository';

@Injectable()
export class VehiclesService {
  constructor(private readonly vehiclesRepository: VehiclesRepository) {}

  async ensureTables(): Promise<void> {
    await this.vehiclesRepository.ensureTables();
  }

  async listPosts(viewerUserId?: string): Promise<VehiclePostRecord[]> {
    return this.vehiclesRepository.listPosts(viewerUserId);
  }

  async createPost(input: {
    title: string;
    description: string;
    imageUrls: string[];
    authorUserId?: string;
    authorName: string;
  }): Promise<VehiclePostRecord> {
    return this.vehiclesRepository.createPost(input);
  }

  async votePost(input: { postId: string; userId: string; vote: -1 | 0 | 1 }): Promise<VehiclePostRecord> {
    return this.vehiclesRepository.votePost(input);
  }

  async deletePost(postId: string): Promise<void> {
    await this.vehiclesRepository.deletePost(postId);
  }
}
