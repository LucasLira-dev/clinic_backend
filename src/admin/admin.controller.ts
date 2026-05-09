import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { AdminGuard } from './guards/admin.guard';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { RedisService } from 'src/redis/redis.service';

// Apenas usuários com role 'admin' podem acessar
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private redisService: RedisService,
  ) {}

  @Post('medicos')
  async createDoctor(
    @Body() dto: CreateDoctorDto,
    @Session() session: UserSession,
  ) {
    if (session.user.role !== 'admin') {
      throw new UnauthorizedException(
        'Acesso negado. Apenas administradores podem criar médicos.',
      );
    }
    await this.redisService.del('all_doctors');
    return this.adminService.createDoctor(dto);
  }

  @Get('users')
  async listUsers(@Query('role') role: string) {
    return this.adminService.listUsers(role);
  }

  @Delete('users/:userId')
  async deleteUser(@Param('userId') userId: string) {
    const result = await this.adminService.deleteUser(userId);

    if (result.userRole === 'doctor') {
      await this.redisService.del('all_doctors');
    }

    return result;
  }
}
