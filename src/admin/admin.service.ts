import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { auth } from '../auth/auth.config';
import { $Enums, Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async createDoctor(dto: CreateDoctorDto) {
    let createdUserId: string | null = null;

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingUser) {
        throw new BadRequestException('Já existe um usuário com este email');
      }

      const existingDoctor = await this.prisma.doctorProfile.findUnique({
        where: { crm: dto.crm },
      });
      if (existingDoctor) {
        throw new BadRequestException('Já existe um médico com este CRM');
      }

      const userResult = await auth.api.createUser({
        body: {
          email: dto.email,
          password: dto.senha,
          name: dto.nome,
          data: { role: 'doctor' },
        },
      });

      if (!userResult?.user?.id) {
        throw new BadRequestException('Erro ao criar usuário');
      }

      createdUserId = userResult.user.id;

      const doctorProfile = await this.prisma.$transaction(async (tx) => {
        const profile = await tx.doctorProfile.create({
          data: {
            userId: createdUserId!,
            fullName: dto.nome,
            crm: dto.crm,
            biography: dto.biografia || null,
            profilePhoto: dto.profilePhoto || null,
          },
        });

        for (const [index, especialidadeNome] of dto.especialidades.entries()) {
          let specialty = await tx.specialty.findFirst({
            where: { name: especialidadeNome },
          });
          if (!specialty) {
            specialty = await tx.specialty.create({
              data: { name: especialidadeNome },
            });
          }
          await tx.doctorSpecialty.create({
            data: {
              doctorProfileId: profile.id,
              specialtyId: specialty.id,
              isPrimary: index === 0,
            },
          });
        }

        for (const dia of dto.diasAtendimento) {
          await tx.doctorWorkingDay.create({
            data: {
              doctorProfileId: profile.id,
              dayOfWeek: dia as $Enums.DayOfWeek,
              startTime: new Date(`1970-01-01T${dto.startTime}:00Z`),
              endTime: new Date(`1970-01-01T${dto.endTime}:00Z`),
            },
          });
        }

        return profile;
      });

      return doctorProfile;
    } catch (error) {
      if (createdUserId) {
        try {
          await this.prisma.user.delete({
            where: { id: createdUserId },
          });
        } catch (cleanupError) {
          console.error('Falha ao remover usuário após erro:', cleanupError);
        }
      }

      console.error('Erro ao criar médico:', error);
      if (error instanceof BadRequestException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException(
          'Erro de banco de dados ao criar médico.',
        );
      }

      throw new BadRequestException(
        'Erro ao criar médico. Por favor, tente novamente.',
      );
    }
  }

  async listUsers(role: string) {
    if (role !== 'doctors' && role !== 'patients') {
      throw new BadRequestException(
        'Role inválida. Use "doctors" ou "patients".',
      );
    }

    if (role === 'doctors') {
      const [users, total] = await this.prisma.$transaction([
        this.prisma.doctorProfile.findMany({
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
              },
            },
            specialties: {
              include: {
                specialty: true,
              },
            },
            workingDays: true,
          },
        }),
        this.prisma.doctorProfile.count(),
      ]);
      return { data: users, total };
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { role: 'patient' },
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              appointments: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where: { role: 'patient' } }),
    ]);
    return { data: users, total };
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    if (user.role === 'admin') {
      throw new BadRequestException(
        'Não é permitido remover usuários com role admin',
      );
    }

    await this.prisma.user.delete({ where: { id: userId } });

    return { success: true, message: 'Usuário removido com sucesso!' };
  }
}
