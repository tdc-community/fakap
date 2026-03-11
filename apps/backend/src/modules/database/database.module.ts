import { Module } from '@nestjs/common';
import { DatabaseInitService } from './database-init.service';
import { DatabaseService } from './database.service';

@Module({
  providers: [DatabaseService, DatabaseInitService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
