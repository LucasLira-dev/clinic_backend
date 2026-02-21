import { AppointmentStatus, DayOfWeek } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  const prismaMock = {
    doctorProfile: {
      findMany: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-19T08:30:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns doctors with available slots and excludes already booked SCHEDULED slots', async () => {
    prismaMock.doctorProfile.findMany.mockResolvedValue([
      {
        id: 'doctor-1',
        fullName: 'Dr. Teste',
        crm: '12345',
        biography: 'Cardiologista',
        profilePhoto: null,
        specialties: [
          {
            isPrimary: true,
            specialty: { id: 'spec-1', name: 'Cardiologia' },
          },
        ],
        workingDays: [{ dayOfWeek: DayOfWeek.QUINTA }],
      },
    ]);

    prismaMock.appointment.findMany.mockResolvedValue([
      {
        doctorProfileId: 'doctor-1',
        appointmentDay: new Date('2026-02-19T11:00:00.000Z'),
      },
    ]);

    const service = new AppointmentsService(prismaMock as any);
    const result = await service.getAvailability({});

    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: AppointmentStatus.SCHEDULED,
        }),
      }),
    );

    expect(result.window).toEqual({
      start: '2026-02-19',
      end: '2026-03-04',
      timezone: 'America/Sao_Paulo',
    });

    expect(result.slotTemplate).toEqual([
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '14:00',
      '15:00',
      '16:00',
    ]);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].workingDays).toEqual([DayOfWeek.QUINTA]);
    expect(result.data[0].availableSlots).not.toContain(
      '2026-02-19T11:00:00.000Z',
    );
    expect(result.data[0].availableSlots).toContain('2026-02-19T12:00:00.000Z');
  });

  it('applies specialty filter when specialtyId is provided', async () => {
    prismaMock.doctorProfile.findMany.mockResolvedValue([]);
    prismaMock.appointment.findMany.mockResolvedValue([]);

    const service = new AppointmentsService(prismaMock as any);
    await service.getAvailability({ specialtyId: 'spec-99' });

    expect(prismaMock.doctorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          specialties: {
            some: {
              specialtyId: 'spec-99',
            },
          },
        },
      }),
    );
  });

  it('returns empty data when no doctors are found', async () => {
    prismaMock.doctorProfile.findMany.mockResolvedValue([]);

    const service = new AppointmentsService(prismaMock as any);
    const result = await service.getAvailability({});

    expect(result.data).toEqual([]);
    expect(prismaMock.appointment.findMany).not.toHaveBeenCalled();
  });
});
