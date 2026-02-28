import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { UpdateDoctorPhotoDto } from './dto/update-photo.dto';
import { PrismaService } from 'src/prisma.service';
import { identity } from 'rxjs';

@Injectable()
export class DoctorService {
  constructor(private prisma: PrismaService) {}

  create(createDoctorDto: CreateDoctorDto) {
    return 'This action adds a new doctor';
  }

  findAll() {
    return `This action returns all doctor`;
  }

  async findOne(userId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        fullName: true,
        crm: true,
        profilePhoto: true,
        biography: true,
        specialties: {
          select: {
            isPrimary: true,
            specialty: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const primarySpecialty =
      doctor?.specialties.find((s) => s.isPrimary)?.specialty.name || null;

    if (!doctor) {
      throw new NotFoundException('Médico não encontrado');
    }

    return {
      id: doctor.id,
      fullName: doctor.fullName,
      crm: doctor.crm,
      profilePhoto: doctor.profilePhoto,
      biography: doctor.biography,
      specialty: primarySpecialty,
    };
  }

  async updatePhoto(
    userId: string,
    updateDoctorPhotoDto: UpdateDoctorPhotoDto,
  ) {
    const existingDoctor = await this.prisma.doctorProfile.findUnique({
      where: { userId },
    });

    if (!existingDoctor) {
      throw new NotFoundException('Médico não encontrado');
    }

    const updatedDoctorPhoto = await this.prisma.doctorProfile.update({
      where: { userId },
      data: {
        profilePhoto: updateDoctorPhotoDto.profilePhoto,
      },
    });

    if (!updatedDoctorPhoto) {
      throw new Error('Erro ao atualizar a foto do médico');
    }

    return updatedDoctorPhoto;
  }

  remove(id: number) {
    return `This action removes a #${id} doctor`;
  }

  async updateBiography(userId: string, biography: string) {
    const existingDoctor = await this.prisma.doctorProfile.findUnique({
      where: { userId },
      select: { biography: true },
    });

    if (!existingDoctor) {
      throw new NotFoundException('Médico não encontrado');
    }

    if (existingDoctor.biography === biography) {
      throw new BadRequestException(
        'A nova biografia deve ser diferente da atual',
      );
    }

    const updatedDoctor = await this.prisma.doctorProfile.update({
      where: { userId },
      data: { biography },
    });

    if (!updatedDoctor) {
      throw new Error('Erro ao atualizar a biografia do médico');
    }

    return updatedDoctor;
  }
}
