import { Controller, Get, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { DoctorGuard } from 'src/guards/doctor.guard';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UpdateDoctorPhotoDto } from './dto/update-photo.dto';
import { RedisService } from 'src/redis/redis.service';

@Controller('doctor')
export class DoctorController {
  constructor(
    private readonly doctorService: DoctorService,
    private redisService: RedisService,
  ) {}

  @Get()
  async findAll() {
    const cachedKey = 'all_doctors';

    const cachedDoctors = await this.redisService.get(cachedKey);

    if (cachedDoctors) {
      return cachedDoctors;
    }

    const doctors = await this.doctorService.findAll();

    await this.redisService.set(cachedKey, doctors, 60 * 60);

    return doctors;
  }

  @Get('doctorProfile/:id')
  async findOneById(@Param('id') id: string) {
    const cachedKey = `doctor_profile_${id}`;

    const cachedProfile = await this.redisService.get(cachedKey);

    if (cachedProfile) {
      return cachedProfile;
    }

    const doctorProfile = await this.doctorService.findDoctorProfile(id);

    await this.redisService.set(cachedKey, doctorProfile, 60 * 30);

    return doctorProfile;
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
    await this.redisService.del(`doctor_profile_${session.user.id}`);
    await this.redisService.del('all_doctors');
    await this.redisService.del(`doctor_details_${session.user.id}`);
    await this.redisService.del('blog_posts');
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
    await this.redisService.del(`doctor_profile_${session.user.id}`);
    await this.redisService.del('all_doctors');
    await this.redisService.del(`doctor_details_${session.user.id}`);
    await this.redisService.del('blog_posts');
    return this.doctorService.updateBiography(session.user.id, biography);
  }
}
