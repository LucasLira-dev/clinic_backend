import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth.config';
import { AdminModule } from './admin/admin.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DoctorModule } from './doctor/doctor.module';
import { MailService } from './mail/mail.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule.forRoot({ auth }),
    AdminModule,
    AppointmentsModule,
    DoctorModule,
  ],
  controllers: [AppController],
  providers: [AppService, MailService],
})
export class AppModule {}
