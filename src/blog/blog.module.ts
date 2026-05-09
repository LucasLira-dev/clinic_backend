import { Module } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogController } from './blog.controller';
import { PrismaService } from 'src/prisma.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [BlogController],
  providers: [BlogService, PrismaService],
})
export class BlogModule {}
