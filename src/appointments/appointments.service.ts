import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

import { parseISO, addMinutes, isSameDay, isAfter, format } from 'date-fns';

import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { Cron } from '@nestjs/schedule';

const BRAZIL_TZ = 'America/Sao_Paulo';

const dayMap = [
  'DOMINGO',
  'SEGUNDA',
  'TERCA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SABADO',
];
const SLOT_MINUTES = 30;

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async bookAppointment(dto: CreateAppointmentDto, patientId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: dto.doctorId },
      select: {
        workingDays: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException('Médico não encontrado');
    }

    const patient = await this.prisma.user.findFirst({
      where: { id: patientId, role: 'patient' },
    });
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }

    const [hour, minute] = dto.time.split(':').map(Number);

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      throw new BadRequestException('Hora inválida. Use o formato HH:mm.');
    }

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new BadRequestException('Hora inválida. Use o formato HH:mm.');
    }

    if (minute % SLOT_MINUTES !== 0) {
      throw new BadRequestException(
        `Minutos devem ser múltiplos de ${SLOT_MINUTES} minutos.`,
      );
    }

    const zonedDate = toZonedTime(
      new Date(`${dto.date}T${dto.time}:00`),
      BRAZIL_TZ,
    ); // Converte para horário de Brasília
    if (Number.isNaN(zonedDate.getTime())) {
      throw new BadRequestException('Data ou hora inválida');
    }

    const dayOfWeek = dayMap[zonedDate.getDay()];

    const workingDay = doctor.workingDays.find(
      (wd) => wd.dayOfWeek === dayOfWeek,
    );
    if (!workingDay) {
      throw new BadRequestException('Médico não trabalha nesse dia');
    }

    const startsAfterOrAtWorkStart =
      hour > workingDay.startHour ||
      (hour === workingDay.startHour && minute >= workingDay.startMinute); //verifica se o horário é depois ou igual ao início do expediente

    const startsBeforeWorkEnd =
      hour < workingDay.endHour ||
      (hour === workingDay.endHour && minute < workingDay.endMinute); //verifica se o horário é antes do fim do expediente

    if (!startsAfterOrAtWorkStart || !startsBeforeWorkEnd) {
      throw new BadRequestException('Médico não trabalha nesse horário');
    }

    const localStart = new Date(`${dto.date}T${dto.time}:00`);
    const appointmentDay = fromZonedTime(localStart, BRAZIL_TZ);
    const startDayUTC = fromZonedTime(
      new Date(`${dto.date}T00:00:00`),
      BRAZIL_TZ,
    );
    const endDayUTC = fromZonedTime(
      new Date(`${dto.date}T23:59:59`),
      BRAZIL_TZ,
    );

    const appointmentsWithDoctorOnDay = await this.prisma.appointment.count({
      where: {
        doctorProfileId: dto.doctorId,
        patientId,
        appointmentDay: {
          gte: startDayUTC,
          lte: endDayUTC,
        },
        status: { notIn: [AppointmentStatus.CANCELED] },
      },
    });

    if (appointmentsWithDoctorOnDay >= 2) {
      throw new BadRequestException(
        'Paciente pode agendar no máximo 2 consultas com este médico no mesmo dia',
      );
    }

    const existingAppointment = await this.prisma.appointment.findFirst({
      where: {
        appointmentDay: appointmentDay,
        status: { notIn: [AppointmentStatus.CANCELED] },
        OR: [{ doctorProfileId: dto.doctorId }, { patientId: patientId }],
      },
      select: {
        id: true,
        doctorProfileId: true,
        patientId: true,
      },
    });
    if (existingAppointment) {
      if (existingAppointment.doctorProfileId === dto.doctorId) {
        throw new BadRequestException(
          'Médico já tem um agendamento nesse horário',
        );
      }

      if (existingAppointment.patientId === patientId) {
        throw new BadRequestException(
          'Paciente já tem um agendamento nesse horário',
        );
      }

      throw new BadRequestException('Horário já está reservado');
    }

    return this.prisma.appointment.create({
      data: {
        doctorProfileId: dto.doctorId,
        patientId: patientId,
        appointmentDay: appointmentDay,
      },
    });
  }

  async getDoctors() {
    const doctors = await this.prisma.doctorProfile.findMany({
      select: {
        id: true,
        fullName: true,
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

    return doctors;
  }

  async getDashboardData(userId: string, role: 'patient' | 'doctor' | 'admin') {
    //buscar a semana atual
    const now = new Date();

    const startOfWeekUTC = fromZonedTime(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay(),
        0,
        0,
        0,
      ),
      BRAZIL_TZ,
    ); //isso pega o domingo da semana atual, mesmo com o fuso horário

    const endOfWeekUTC = fromZonedTime(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + (6 - now.getDay()),
        23,
        59,
        59,
      ),
      BRAZIL_TZ,
    ); //isso garante que estamos pegando a semana inteira, mesmo com o fuso horário

    const weekAppointments = await this.prisma.appointment.findMany({
      where: {
        appointmentDay: {
          gte: startOfWeekUTC,
          lte: endOfWeekUTC,
        },
        status: { notIn: [AppointmentStatus.CANCELED] },
      },
    }); //busca todas as consultas da ultima semana, independente do usuário

    const totalWeekAppointments = weekAppointments.length; //total de consultas na semana

    const totalCompletedAppointments = weekAppointments.filter(
      (a) => a.status === AppointmentStatus.COMPLETED,
    ).length; //filtra as consultas que foram realizadas

    const totalPatients = await this.prisma.user.count({
      where: { role: 'patient' },
    }); //conta o total de pacientes cadastrados

    const totalDoctors = await this.prisma.doctorProfile.count(); //conta o total de médicos cadastrados

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { notIn: [AppointmentStatus.CANCELED] },
      },
      select: {
        appointmentDay: true,
      },
    });

    const byWeekday = appointments.reduce(
      (acc, appt) => {
        const localDate = toZonedTime(appt.appointmentDay, BRAZIL_TZ); //converte a data da consulta para o horário de Brasília
        const dayIndex = localDate.getDay(); //pega o dia da semana (0-6)
        const dayName = dayMap[dayIndex]; //converte para o nome do dia
        acc[dayName] += 1; //incrementa a contagem do dia correspondente
        return acc;
      },
      {
        DOMINGO: 0,
        SEGUNDA: 0,
        TERCA: 0,
        QUARTA: 0,
        QUINTA: 0,
        SEXTA: 0,
        SABADO: 0,
      },
    );

    type DashboardNextAppointment = {
      id: string;
      appointmentDay: Date;
      counterpartName: string;
      counterpartRole: 'doctor' | 'patient';
      counterpartSpecialty: string | null;
    };

    const nowUTC = new Date();
    let nextAppointments: DashboardNextAppointment[] = [];

    if (role === 'patient') {
      const patientAppointments = await this.prisma.appointment.findMany({
        where: {
          patientId: userId,
          appointmentDay: { gt: nowUTC },
          status: { not: AppointmentStatus.CANCELED },
        },
        take: 2,
        orderBy: { appointmentDay: 'asc' },
        select: {
          id: true,
          appointmentDay: true,
          status: true,
          doctorProfile: {
            select: {
              fullName: true,
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
          },
        },
      });

      nextAppointments = patientAppointments.map((appointment) => {
        const primarySpecialty =
          appointment.doctorProfile.specialties.find((s) => s.isPrimary)
            ?.specialty.name ??
          appointment.doctorProfile.specialties[0]?.specialty.name ??
          null;

        return {
          id: appointment.id,
          appointmentDay: appointment.appointmentDay,
          counterpartName: appointment.doctorProfile.fullName,
          counterpartRole: 'doctor',
          counterpartSpecialty: primarySpecialty,
          status: appointment.status,
        };
      });
    } else if (role === 'doctor') {
      const doctorAppointments = await this.prisma.appointment.findMany({
        where: {
          doctorProfile: {
            userId,
          },
          appointmentDay: { gt: nowUTC },
          status: { not: AppointmentStatus.CANCELED },
        },
        take: 2,
        orderBy: { appointmentDay: 'asc' },
        select: {
          id: true,
          appointmentDay: true,
          patient: {
            select: {
              name: true,
            },
          },
          status: true,
        },
      });

      nextAppointments = doctorAppointments.map((appointment) => ({
        id: appointment.id,
        appointmentDay: appointment.appointmentDay,
        counterpartName: appointment.patient.name,
        counterpartRole: 'patient',
        counterpartSpecialty: null,
        status: appointment.status,
      }));
    }

    return {
      totalWeekAppointments,
      totalCompletedAppointments,
      totalPatients,
      totalDoctors,
      appointmentsByWeekday: byWeekday,
      upcomingAppointments: nextAppointments,
    };
  }

  async getDoctorDetails(doctorId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      select: {
        id: true,
        fullName: true,
        profilePhoto: true,
        crm: true,
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
        workingDays: {
          select: {
            dayOfWeek: true,
            startHour: true,
            startMinute: true,
            endHour: true,
            endMinute: true,
          },
        },
      },
    });

    if (!doctor) return null;

    const workingDaysMap = new Map();
    for (const wd of doctor.workingDays) {
      workingDaysMap.set(wd.dayOfWeek, {
        startHour: wd.startHour,
        startMinute: wd.startMinute,
        endHour: wd.endHour,
        endMinute: wd.endMinute,
      });
    }

    return {
      ...doctor,
    };
  }

  async getDoctorAvailableSlots(
    doctorId: string,
    date: string,
    patientId: string,
  ) {
    if (!date) {
      throw new BadRequestException('Data é obrigatória');
    }

    const parsedDate = parseISO(date);

    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Data inválida. Use o formato YYYY-MM-DD.');
    }

    const startDayUTC = fromZonedTime(new Date(`${date}T00:00:00`), BRAZIL_TZ);

    const endDayUTC = fromZonedTime(new Date(`${date}T23:59:59`), BRAZIL_TZ);

    const todayUTC = new Date();
    const isToday = isSameDay(
      toZonedTime(startDayUTC, BRAZIL_TZ),
      toZonedTime(todayUTC, BRAZIL_TZ),
    );

    const zonedDate = toZonedTime(new Date(`${date}T00:00:00`), BRAZIL_TZ);

    const dayOfWeek = dayMap[zonedDate.getDay()];

    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: {
        workingDays: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException('Médico não encontrado');
    }

    const workingDay = doctor.workingDays.find(
      (wd) => wd.dayOfWeek === dayOfWeek,
    );

    if (!workingDay) return [];

    const slots: Date[] = [];

    let current = new Date(startDayUTC); // Começa do início do dia solicitado
    current.setHours(workingDay.startHour, workingDay.startMinute, 0, 0);

    const endTime = new Date(startDayUTC);
    endTime.setHours(workingDay.endHour, workingDay.endMinute, 0, 0);

    while (current < endTime) {
      slots.push(new Date(current));

      current = addMinutes(current, 30);
    }

    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorProfileId: doctorId,
        appointmentDay: {
          gte: startDayUTC,
          lte: endDayUTC,
        },
        status: {
          notIn: [AppointmentStatus.CANCELED],
        },
      },
    });

    const bookedTimes = appointments.map((a) => a.appointmentDay.getTime());

    let availableSlots = slots.filter(
      (slot) => !bookedTimes.includes(slot.getTime()),
    );

    if (isToday) {
      const nowUTC = new Date();
      availableSlots = availableSlots.filter((slot) => isAfter(slot, nowUTC));
    }

    const formattedSlots = availableSlots.map((slot) => {
      const brDate = toZonedTime(slot, BRAZIL_TZ);
      return format(brDate, 'HH:mm');
    });

    const appointmentsWithDoctorOnDay = await this.prisma.appointment.count({
      where: {
        doctorProfileId: doctorId,
        patientId,
        appointmentDay: {
          gte: startDayUTC,
          lte: endDayUTC,
        },
        status: { notIn: [AppointmentStatus.CANCELED] },
      },
    });

    const canAppoint = appointmentsWithDoctorOnDay < 2;

    return {
      date: zonedDate,
      slots: formattedSlots,
      canAppoint: canAppoint,
    };
  }

  async getMyAppointments(
    userId: string,
    filter: 'upcoming' | 'completed' | 'all' | 'canceled',
    role: string,
  ) {
    let baseWhere: any = {};
    let include: any = {};

    if (role === 'patient') {
      baseWhere = { patientId: userId };
      include = {
        doctorProfile: {
          select: {
            fullName: true,
            specialties: {
              select: {
                isPrimary: true,
                specialty: { select: { name: true } },
              },
            },
          },
        },
      };
    } else if (role === 'doctor') {
      const profile = await this.prisma.doctorProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!profile)
        throw new NotFoundException(
          'Perfil de médico não encontrado para este usuário',
        );

      baseWhere = { doctorProfileId: profile.id };
      include = {
        patient: { select: { id: true, name: true } },
      };
    } else {
      throw new BadRequestException('Role inválida');
    }

    const now = new Date();
    const whereByFilter =
      filter === 'all'
        ? {}
        : filter === 'upcoming'
          ? {
              appointmentDay: { gt: now },
              status: { notIn: [AppointmentStatus.CANCELED] },
            }
          : filter === 'completed'
            ? {
                appointmentDay: { lte: now },
                status: AppointmentStatus.COMPLETED,
              }
            : filter === 'canceled'
              ? { status: AppointmentStatus.CANCELED }
              : (() => {
                  throw new BadRequestException('Filtro inválido');
                })();

    const orderBy =
      filter === 'upcoming'
        ? { appointmentDay: 'asc' as const }
        : { appointmentDay: 'desc' as const };

    return this.prisma.appointment.findMany({
      where: { ...baseWhere, ...whereByFilter },
      include,
      orderBy,
    });
  }

  async getAppointmentDetails(
    appointmentId: string,
    userId: string,
    role: string,
  ) {
    let whereByRole: Record<string, string> = {};

    if (role === 'patient') {
      whereByRole = { patientId: userId };
    } else if (role === 'doctor') {
      const profile = await this.prisma.doctorProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!profile)
        throw new NotFoundException(
          'Perfil de médico não encontrado para este usuário',
        );

      whereByRole = { doctorProfileId: profile.id };
    } else {
      throw new BadRequestException('Role inválida');
    }

    const appointment = await this.prisma.appointment.findFirst({
      where: { ...whereByRole, id: appointmentId },
      include: {
        doctorProfile: {
          select: {
            fullName: true,
            profilePhoto: true,
            crm: true,
            specialties: {
              select: {
                isPrimary: true,
                specialty: { select: { name: true } },
              },
            },
          },
        },
        patient: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Consulta não encontrada');
    }

    return appointment;
  }

  async cancelAppointment(
    appointmentId: string,
    userId: string,
    userRole: string,
  ) {
    let whereByRole: Record<string, string> = {};

    if (userRole === 'patient') {
      whereByRole = { patientId: userId };
    } else if (userRole === 'doctor') {
      const profile = await this.prisma.doctorProfile.findUnique({
        where: { userId },
      });
      if (!profile) {
        throw new NotFoundException(
          'Perfil de médico não encontrado para este usuário',
        );
      }
      whereByRole = { doctorProfileId: profile.id };
    } else {
      throw new BadRequestException('Role inválida');
    }

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        ...whereByRole,
        status: { notIn: [AppointmentStatus.CANCELED] },
        id: appointmentId,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Consulta não encontrada');
    }

    if (appointment.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException(
        'Consulta já foi realizada e não pode ser cancelada',
      );
    }

    if (appointment.appointmentDay < new Date()) {
      throw new BadRequestException(
        'Consulta já passou e não pode ser cancelada',
      );
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CANCELED },
    });
  }

  async completeAppointment(
    appointmentId: string,
    doctorId: string,
    userRole: string,
  ) {
    if (userRole !== 'doctor') {
      throw new BadRequestException('Apenas médicos podem completar consultas');
    }

    const profile = await this.prisma.doctorProfile.findUnique({
      where: { userId: doctorId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Perfil de médico não encontrado para este usuário',
      );
    }

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        doctorProfileId: profile.id,
        status: { notIn: [AppointmentStatus.CANCELED] },
        id: appointmentId,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Consulta não encontrada');
    }

    if (appointment.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Consulta já foi realizada');
    }

    if (appointment.appointmentDay > new Date()) {
      throw new BadRequestException(
        'Consulta ainda não aconteceu e não pode ser marcada como realizada',
      );
    }

    if (appointment.doctorProfileId !== profile.id) {
      throw new BadRequestException(
        'Médico só pode completar suas próprias consultas',
      );
    }

    if (appointment.status === AppointmentStatus.NO_SHOW) {
      throw new BadRequestException(
        'Consulta não foi realizada e não pode ser marcada como concluída',
      );
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.COMPLETED },
    });
  }

  @Cron('0 21 * * *', { timeZone: BRAZIL_TZ })
  async markNoShow() {
    const now = new Date();

    const yyyyMmDd = new Intl.DateTimeFormat('en-CA', {
      timeZone: BRAZIL_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const startOfDayUtc = fromZonedTime(`${yyyyMmDd}T00:00:00`, BRAZIL_TZ);

    const result = await this.prisma.appointment.updateMany({
      where: {
        status: AppointmentStatus.SCHEDULED,
        appointmentDay: {
          gte: startOfDayUtc,
          lte: now,
        },
      },
      data: { status: AppointmentStatus.NO_SHOW },
    });

    this.logger.log(
      `NO_SHOW diário executado: ${result.count} consultas marcadas como NO_SHOW`,
    );
  }
}
