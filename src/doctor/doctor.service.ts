import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateDoctorPhotoDto } from './dto/update-photo.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class DoctorService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const doctors = await this.prisma.doctorProfile.findMany({
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
        _count: {
          select: {
            workingDays: true,
          },
        },
      },
    });

    return doctors;
  }

  async findDoctorProfile(id: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id },
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
        posts: {
          select: {
            id: true,
            title: true,
            description: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 3,
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException('Médico não encontrado');
    }

    const specialty =
      doctor.specialties.find((s) => s.isPrimary)?.specialty.name || null;

    const workingDays = await this.prisma.doctorWorkingDay.findMany({
      where: { doctorProfileId: doctor.id },
      select: {
        dayOfWeek: true,
        startHour: true,
        endHour: true,
      },
    });

    const startHour = workingDays.map((at) => at.startHour);
    const endHour = workingDays.map((at) => at.endHour);

    const slots: string[] = [];

    let currentHour = startHour[0];
    const endHourTime = endHour[0];

    while (currentHour < endHourTime) {
      slots.push(currentHour.toString().padStart(2, '0') + ':00');
      slots.push(currentHour.toString().padStart(2, '0') + ':30');
      currentHour++;
    }

    const weeklyAppointments = slots.length * workingDays.length;

    return {
      id: doctor.id,
      fullName: doctor.fullName,
      crm: doctor.crm,
      profilePhoto: doctor.profilePhoto,
      biography: doctor.biography,
      specialty: specialty,
      weeklyAppointments,
      daysOfWork: workingDays.length,
      workingDays: workingDays.map((wd) => ({ dayOfWeek: wd.dayOfWeek })),
      posts: doctor.posts,
      slots,
    };
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
