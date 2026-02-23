import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

import { parseISO, addMinutes, isSameDay, isAfter, format } from 'date-fns';

import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  async bookAppointment(dto: CreateAppointmentDto, patientId: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id: dto.doctorId },
      include: {
        workingDays: true,
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
    const startDayUTC = fromZonedTime(new Date(`${dto.date}T00:00:00`), BRAZIL_TZ);
    const endDayUTC = fromZonedTime(new Date(`${dto.date}T23:59:59`), BRAZIL_TZ);

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

  async getDoctorAvailableSlots(doctorId: string, date: string, patientId: string) {
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
}
