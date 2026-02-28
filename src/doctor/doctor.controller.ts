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

@UseGuards(DoctorGuard)
@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Post()
  create(@Body() createDoctorDto: CreateDoctorDto) {
    return this.doctorService.create(createDoctorDto);
  }

  @Get()
  findAll() {
    return this.doctorService.findAll();
  }

  @Get('me')
  findOne(@Session() session: UserSession) {
    return this.doctorService.findOne(session.user.id);
  }

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

  @Patch('me/biography')
  async updateBiography(
    @Body('biography') biography: string,
    @Session() session: UserSession,
  ) {
    return this.doctorService.updateBiography(session.user.id, biography);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.doctorService.remove(+id);
  }
}
