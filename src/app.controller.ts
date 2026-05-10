import { Controller, Get, Head, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @AllowAnonymous()
  @Head('health')
  healthCheck() {
    return {
      status: HttpStatus.OK,
      message: 'Service is healthy',
    };
  }
}
