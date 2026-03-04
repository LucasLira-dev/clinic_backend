import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { DoctorGuard } from 'src/guards/doctor.guard';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UpdateDoctorPhotoDto } from './dto/update-photo.dto';

@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Get()
  findAll() {
    return this.doctorService.findAll();
  }

  @Get('doctorProfile/:id')
  findOneById(@Param('id') id: string) {
    return this.doctorService.findDoctorProfile(id);
  }

  @Get('me')
  findOne(@Session() session: UserSession) {
    return this.doctorService.findOne(session.user.id);
  }

  @UseGuards(DoctorGuard)
  @Patch('me/photo')
  async update(
    @Body() updateDoctorPhotoDto: UpdateDoctorPhotoDto,
    @Session() session: UserSession,
  ) {
    return this.doctorService.updatePhoto(
      session.user.id,
      updateDoctorPhotoDto,
    );
  }

  @UseGuards(DoctorGuard)
  @Patch('me/biography')
  async updateBiography(
    @Body('biography') biography: string,
    @Session() session: UserSession,
  ) {
    return this.doctorService.updateBiography(session.user.id, biography);
  }
}
