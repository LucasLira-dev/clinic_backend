import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

import {
  parseISO,
  startOfDay,
  endOfDay,
  addMinutes,
  isSameDay,
  isAfter,
  format,
} from 'date-fns';

import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const BRAZIL_TZ = 'America/Sao_Paulo';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getDoctorDetails(doctorId: string) {
    // Busca detalhes do médico, incluindo dias e horários de trabalho
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
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    if (!doctor) return null;

    // Monta um mapa dos dias de trabalho e horários
    const workingDaysMap = new Map();
    for (const wd of doctor.workingDays) {
      workingDaysMap.set(wd.dayOfWeek, {
        startTime: wd.startTime,
        endTime: wd.endTime,
      });
    }

    return {
      ...doctor,
    };
  }

  async getDoctorAvailableSlots(doctorId: string, date: string) {
    const parsedDate = parseISO(date);

    // Interpreta a data como sendo de São Paulo
    const utcDate = fromZonedTime(parsedDate, BRAZIL_TZ);

    const startDayUTC = startOfDay(utcDate);
    const endDayUTC = endOfDay(utcDate);

    const todayUTC = new Date();
    const isToday = isSameDay(
      toZonedTime(utcDate, BRAZIL_TZ),
      toZonedTime(todayUTC, BRAZIL_TZ),
    );

    const dayMap = [
      'DOMINGO',
      'SEGUNDA',
      'TERCA',
      'QUARTA',
      'QUINTA',
      'SEXTA',
      'SABADO',
    ];

    const zonedDate = toZonedTime(utcDate, BRAZIL_TZ);
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
    current.setHours(
      workingDay.startTime.getUTCHours(),
      workingDay.startTime.getUTCMinutes(),
      0,
      0,
    );

    const endTime = new Date(startDayUTC);
    endTime.setHours(
      workingDay.endTime.getUTCHours(),
      workingDay.endTime.getUTCMinutes(),
      0,
      0,
    );

    while (current < endTime) {
      const utcSlot = fromZonedTime(current, BRAZIL_TZ);

      slots.push(utcSlot);

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

    return {
      date: zonedDate,
      slots: formattedSlots,
    };
  }

  // async getDoctorAvailableSlots(doctorId: string, date: string) {
  //   // Ignora a hora e usa sempre o horário local de Brasília (GMT-3) para calcular o dia da semana
  //   const inputDate = new Date(date);
  //   // Cria uma data só com ano, mês e dia, no horário de Brasília
  //   const requestedDate = new Date(Date.UTC(
  //     inputDate.getUTCFullYear(),
  //     inputDate.getUTCMonth(),
  //     inputDate.getUTCDate(),
  //     3, 0, 0 // 03:00 UTC = 00:00 GMT-3
  //   ));

  //   const now = new Date();
  //   const isSameDay =
  //     requestedDate.getUTCFullYear() === now.getUTCFullYear() &&
  //     requestedDate.getUTCMonth() === now.getUTCMonth() &&
  //     requestedDate.getUTCDate() === now.getUTCDate();

  //   // Calcula o dia da semana no horário de Brasília
  //   const brDate = new Date(requestedDate.getTime() - 3 * 60 * 60 * 1000);
  //   const dayNumber = brDate.getUTCDay();
  //   const dayMap: Record<number, string> = {
  //     0: 'DOMINGO',
  //     1: 'SEGUNDA',
  //     2: 'TERCA',
  //     3: 'QUARTA',
  //     4: 'QUINTA',
  //     5: 'SEXTA',
  //     6: 'SABADO',
  //   };
  //   const dayOfWeek = dayMap[dayNumber];

  //   const doctor = await this.prisma.doctorProfile.findFirst({
  //     where: { id: doctorId },
  //     include: {
  //       workingDays: true,
  //     },
  //   });

  //   if (!doctor) {
  //     throw new NotFoundException('Médico não encontrado');
  //   }

  //   const workingDay = doctor.workingDays.find(
  //     (d) => d.dayOfWeek === dayOfWeek,
  //   );

  //   if (!workingDay) {
  //     return [];
  //   }

  //   // Gerar slots de 30 em 30 minutos entre startTime e endTime, usando o dia solicitado
  //   const slots: Date[] = [];
  //   const startTime = new Date(workingDay.startTime);
  //   const endTime = new Date(workingDay.endTime);

  //   // Usa horário UTC salvo no banco para garantir horário correto
  //   const start = new Date(requestedDate);
  //   start.setHours(startTime.getUTCHours(), startTime.getUTCMinutes(), 0, 0);
  //   const end = new Date(requestedDate);
  //   end.setHours(endTime.getUTCHours(), endTime.getUTCMinutes(), 0, 0);

  //   const current = new Date(start);
  //   while (current < end) {
  //     slots.push(new Date(current));
  //     current.setMinutes(current.getMinutes() + 30);
  //   }

  //   // Buscar appointments do médico para o dia
  //   const startOfDay = new Date(requestedDate);
  //   startOfDay.setHours(0, 0, 0, 0);
  //   const endOfDay = new Date(requestedDate);
  //   endOfDay.setHours(23, 59, 59, 999);

  //   const appointments = await this.prisma.appointment.findMany({
  //     where: {
  //       doctorProfileId: doctorId,
  //       appointmentDay: {
  //         gte: startOfDay,
  //         lte: endOfDay,
  //       },
  //       status: {
  //         notIn: [AppointmentStatus.CANCELED],
  //       },
  //     },
  //   });

  //   // Filtrar slots já marcados
  //   const bookedTimes = appointments.map((a) => a.appointmentDay.getTime());
  //   const availableSlots = slots.filter(
  //     (slot) => !bookedTimes.includes(slot.getTime())
  //   );

  //   let filteredSlots = availableSlots;

  //   if (isSameDay) {
  //     const nowUTC = new Date();
  //     const nowBR = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000);
  //     filteredSlots = availableSlots.filter((slot) => {
  //       // slot também precisa ser comparado no horário de Brasília
  //       const slotBR = new Date(slot.getTime() - 3 * 60 * 60 * 1000);
  //       return slotBR > nowBR;
  //     });
  //   }

  //   // Retornar apenas os horários no formato HH:mm
  //   const formattedSlots = filteredSlots.map((slot) => {
  //     const hours = slot.getHours().toString().padStart(2, '0');
  //     const minutes = slot.getMinutes().toString().padStart(2, '0');
  //     return `${hours}:${minutes}`;
  //   });

  //   return {
  //     date: requestedDate,
  //     slots: formattedSlots,
  //   };
  // }
}
