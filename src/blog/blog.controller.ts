import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { DoctorGuard } from 'src/guards/doctor.guard';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { RedisService } from 'src/redis/redis.service';

@Controller('blog')
export class BlogController {
  constructor(
    private readonly blogService: BlogService,
    private redisService: RedisService,
  ) {}

  @UseGuards(DoctorGuard)
  @Post('createPost')
  async create(
    @Body() createPostDto: CreatePostDto,
    @Session() session: UserSession,
  ) {
    const doctorId = session.user.id;
    await this.redisService.del('blog_posts');

    return this.blogService.create(createPostDto, doctorId);
  }

  @Get()
  async findAll() {
    const cacheKey = 'blog_posts';

    const cachedPosts = await this.redisService.get(cacheKey);

    if (cachedPosts) {
      return cachedPosts;
    }

    const posts = await this.blogService.findAll();

    await this.redisService.set(cacheKey, posts, 60 * 120);

    return posts;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const cacheKey = `blog_post_${id}`;

    const cachedPost = await this.redisService.get(cacheKey);

    if (cachedPost) {
      return cachedPost;
    }

    const post = await this.blogService.findOne(id);

    await this.redisService.set(cacheKey, post, 60 * 120);

    return post;
  }

  @UseGuards(DoctorGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Session() session: UserSession) {
    const doctorId = session.user.id;
    await this.redisService.del('blog_posts');
    await this.redisService.del(`blog_post_${id}`);

    return this.blogService.remove(id, doctorId);
  }
}
