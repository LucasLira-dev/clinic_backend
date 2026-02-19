import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { auth } from '../auth/auth.config';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async createDoctor(dto: CreateDoctorDto) {
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

      // 3. Gerar senha temporária aleatória
      const senhaTemporaria = this.gerarSenhaAleatoria();

      // 4. Criar usuário using Better-auth admin API
      const userResult = await auth.api.createUser({
        body: {
          email: dto.email,
          password: senhaTemporaria,
          name: dto.nome,
          data: {
            role: 'doctor',
          },
        },
      });


      if (!userResult) {
        throw new BadRequestException('Erro ao criar usuário');
      }

      const userId = userResult.user.id;

      // 5. Criar DoctorProfile
      const doctorProfile = await this.prisma.doctorProfile.create({
        data: {
          userId: userId,
          fullName: dto.nome,
          crm: dto.crm,
          biography: dto.biografia || null,
          profilePhoto: dto.profilePhoto || null,
        },
      });

      // 6. Processar especialidades
      for (const especialidadeNome of dto.especialidades) {
        // Buscar ou criar especialidade
        let specialty = await this.prisma.specialty.findFirst({
          where: { name: especialidadeNome },
        });

        if (!specialty) {
          specialty = await this.prisma.specialty.create({
            data: { name: especialidadeNome },
          });
        }

        // Criar relação médico-especialidade
        await this.prisma.doctorSpecialty.create({
          data: {
            doctorProfileId: doctorProfile.id,
            specialtyId: specialty.id,
            isPrimary: dto.especialidades[0] === especialidadeNome, // Primeira é principal
          },
        });
      }

      // 7. Criar dias de atendimento
      for (const dia of dto.diasAtendimento) {
        await this.prisma.doctorWorkingDay.create({
          data: {
            doctorProfileId: doctorProfile.id,
            dayOfWeek: dia as any, // Enum DayOfWeek
          },
        });
      }

      return {
        success: true,
        message: 'Médico cadastrado com sucesso!',
        data: {
          userId,
          email: dto.email,
          senhaTemporaria, // IMPORTANTE: Remover isso em produção!
          doctorProfile,
        },
      };
    } catch (error) {
      console.error('Erro ao criar médico:', error);
      throw new BadRequestException(
        error.message || 'Erro ao cadastrar médico',
      );
    }
  }

  // async listDoctors() {
  //   const doctors = await this.prisma.doctorProfile.findMany({
  //     include: {
  //       user: {
  //         select: {
  //           id: true,
  //           name: true,
  //           email: true,
  //           image: true,
  //           role: true,
  //         },
  //       },
  //       specialties: {
  //         include: {
  //           specialty: true,
  //         },
  //       },
  //       workingDays: true,
  //     },
  //   });

  //   return {
  //     data: doctors
  //   };
  // }

 
  async listUsers(role: string) {
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
            }
          }
        }
      }),
      this.prisma.user.count({ where: { role: 'patient' } }),
    ])
    return { data: users, total };
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    await this.prisma.user.delete({ where: { id: userId } });

    return { success: true, message: 'Usuário removido com sucesso!' };
  }

  private gerarSenhaAleatoria(): string {
    const length = 12;
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    let password = '';

    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    return password;
  }

}
