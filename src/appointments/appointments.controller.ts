import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

type AppointmentFilter = 'upcoming' | 'completed' | 'all' | 'canceled';

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

  @Post('cancel/:id')
  async cancelAppointment(
    @Param('id') appointmentId: string,
    @Session() session: UserSession,
  ) {
    const userId = session.user.id;
    const userRole = session.user.role as 'patient' | 'doctor';
    return this.appointmentsService.cancelAppointment(appointmentId, userId, userRole);
  }

  @Post('complete/:id')
  async completeAppointment(
    @Param('id') appointmentId: string,
    @Session() session: UserSession,
  ) {
    const doctorId = session.user.id;
    const userRole = session.user.role as 'patient' | 'doctor';
    return this.appointmentsService.completeAppointment(appointmentId, doctorId, userRole);
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
  ) {
    const patientId = session.user.id;
    return this.appointmentsService.getDoctorAvailableSlots(
      doctorId,
      date,
      patientId,
    );
  }

  @Get('my-appointments')
  async getMyAppointments(
    @Session() session: UserSession,
    @Query('filter') filter: AppointmentFilter = 'all',
  ) {
    const userId = session.user.id;
    const role = session.user.role as 'patient' | 'doctor';
    return this.appointmentsService.getMyAppointments(userId, filter, role);
  }

  @Get('details/:id')
  async getAppointmentDetails(
    @Param('id') appointmentId: string,
    @Session() session: UserSession,
  ) {
    const patientId = session.user.id;
    const role = session.user.role as 'patient' | 'doctor';
    return this.appointmentsService.getAppointmentDetails(
      appointmentId,
      patientId,
      role,
    );
  }
}
