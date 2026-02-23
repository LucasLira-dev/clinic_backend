import { Controller, Get, Param, Post, Query, UseGuards, Body } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PatientGuard } from './guards/patient.guard';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

@UseGuards(PatientGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post('book')
  async bookAppointment(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @Session() session: UserSession,
  ) {
    const patientId = session.user.id;
    return this.appointmentsService.bookAppointment(
      createAppointmentDto,
      patientId,
    );
  }

  @Get('doctors')
  async getDoctors() {
    return this.appointmentsService.getDoctors();
  }

  @Get('doctor/:id')
  async getDoctorDetails(@Param('id') doctorId: string) {
    return this.appointmentsService.getDoctorDetails(doctorId);
  }

  @Get('doctor/:id/available-slots')
  async getDoctorAvailableSlots(
    @Param('id') doctorId: string,
    @Query('date') date: string,
    @Session() session: UserSession,
  ) {4
    const patientId = session.user.id;
    return this.appointmentsService.getDoctorAvailableSlots(doctorId, date, patientId);
  }
}
