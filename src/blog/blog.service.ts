import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPostDto: CreatePostDto, doctorId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: {
        userId: doctorId,
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return this.prisma.post.create({
      data: {
        title: createPostDto.title,
        content: createPostDto.content,
        description: createPostDto.description,
        tag: createPostDto.tag,
        doctorProfileId: doctor.id,
      },
    });
  }

  async findAll() {
    return this.prisma.post.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        tag: true,
        createdAt: true,
        doctorProfile: {
          select: {
            id: true,
            profilePhoto: true,
            fullName: true,
            specialties: {
              where: {
                isPrimary: true,
              },
              select: {
                specialty: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: {
        id,
      },
      include: {
        doctorProfile: {
          select: {
            id: true,
            profilePhoto: true,
            fullName: true,
            specialties: {
              where: {
                isPrimary: true,
              },
              select: {
                specialty: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async remove(id: string, doctorId: string) {
    const post = await this.prisma.post.findUnique({
      where: {
        id,
      },
      select: {
        doctorProfile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.doctorProfile.userId !== doctorId) {
      throw new UnauthorizedException(
        'You are not authorized to delete this post',
      );
    }

    return this.prisma.post.delete({
      where: {
        id,
      },
    });
  }
}
