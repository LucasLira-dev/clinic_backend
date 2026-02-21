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

    if (!date) {
      throw new BadRequestException('Data é obrigatória');
    }

    const parsedDate = parseISO(date);
    
    if (isNaN(parsedDate.getTime())) {
     throw new BadRequestException('Data inválida. Use o formato YYYY-MM-DD.');
    }

    // Interpreta a data como sendo de São Paulo
    const utcDate = fromZonedTime(parsedDate, BRAZIL_TZ);

    const startDayUTC = fromZonedTime(startOfDay(parsedDate), BRAZIL_TZ);
    const endDayUTC = fromZonedTime(endOfDay(parsedDate), BRAZIL_TZ);

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
    current.setUTCHours(
      workingDay.startTime.getUTCHours(),
      workingDay.startTime.getUTCMinutes(),
      0,
      0,
    );

    const endTime = new Date(startDayUTC);
    endTime.setUTCHours(
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
}
