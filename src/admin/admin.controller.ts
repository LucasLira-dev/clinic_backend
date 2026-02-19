import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { AdminGuard } from './guards/admin.guard';

// Apenas usuários com role 'admin' podem acessar
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('medicos')
  async createDoctor(@Body() dto: CreateDoctorDto) {
    // Se precisar acessar o usuário autenticado, use:
    // async createDoctor(@Body() dto: CreateDoctorDto, @CurrentUser() user: any)
    return this.adminService.createDoctor(dto);
  }

  @Get('users')
  async listUsers(
    @Query('role') role: string,
  ) {
    return this.adminService.listUsers(role);
  }

  @Delete('users/:userId')
  async deleteDoctor(@Param('userId') userId: string) {
    return this.adminService.deleteUser(userId);
  }
}
