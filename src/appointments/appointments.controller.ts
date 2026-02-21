import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PatientGuard } from './guards/patient.guard';

@UseGuards(PatientGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

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
  ) {
    return this.appointmentsService.getDoctorAvailableSlots(doctorId, date);
  }
}
