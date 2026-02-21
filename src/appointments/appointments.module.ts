import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma.service';
import { PatientGuard } from './guards/patient.guard';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, PrismaService, PatientGuard],
})
export class AppointmentsModule {}
