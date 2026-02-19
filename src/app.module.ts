import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth.config';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [AuthModule.forRoot({ auth }), AdminModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
