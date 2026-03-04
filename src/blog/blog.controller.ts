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

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @UseGuards(DoctorGuard)
  @Post('createPost')
  create(
    @Body() createPostDto: CreatePostDto,
    @Session() session: UserSession,
  ) {
    const doctorId = session.user.id;
    return this.blogService.create(createPostDto, doctorId);
  }

  @Get()
  findAll() {
    return this.blogService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.blogService.findOne(id);
  }

  @UseGuards(DoctorGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Session() session: UserSession) {
    const doctorId = session.user.id;
    return this.blogService.remove(id, doctorId);
  }
}
