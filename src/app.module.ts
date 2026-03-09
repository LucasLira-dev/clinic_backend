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
import { BlogModule } from './blog/blog.module';
import { ConfigModule } from '@nestjs/config';
import {
  ArcjetModule,
  detectBot,
  shield,
  slidingWindow,
} from '@arcjet/nest';
import { CustomArcjetGuard } from './guards/arcjet.guard';
import { APP_GUARD } from '@nestjs/core';

if (!process.env.ARCJET_ENV && process.env.ARCJET_ENV !== 'test') {
  throw new Error('ARCJET_KEY environment variable is not defined.');
}

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule.forRoot({ auth }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ArcjetModule.forRoot({
      isGlobal: true,
      key: process.env.ARCJET_KEY!,
      characteristics: ['ip.src'],
      rules: [
        // Shield protects your app from common attacks e.g. SQL injection
        shield({ mode: 'LIVE' }),
        // Create a bot detection rule
        detectBot({
          mode: 'LIVE', // Blocks requests. Use "DRY_RUN" to log only
          // Block all bots except the following
          allow: [
            'CATEGORY:SEARCH_ENGINE', // Google, Bing, etc
            'CATEGORY:PREVIEW', // Link previews e.g. Slack, Discord
          ],
        }),
        slidingWindow({
          mode: 'LIVE',
          interval: '1m',
          max: 5, //
        }),
      ],
    }),
    AdminModule,
    AppointmentsModule,
    DoctorModule,
    BlogModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    MailService,
    {
      provide: APP_GUARD,
      useClass: CustomArcjetGuard,
    },
  ],
})
export class AppModule {}
