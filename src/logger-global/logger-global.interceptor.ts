import {
  CallHandler,
  ConsoleLogger,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, finalize } from 'rxjs';

interface User {
  id: string;
  role: string;
}

interface RequestWithUser extends Request {
  user?: User;
}

@Injectable()
export class LoggerGlobalInterceptor implements NestInterceptor {
  constructor(private logger: ConsoleLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request & RequestWithUser>();
    const response = httpContext.getResponse<Response>();

    const { statusCode } = response;

    const timeNow = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const userId = request.user?.id || 'Anonymous';

        this.logger.log(
          `${request.method} ${request.url} - ${statusCode} - User: ${userId} - ${Date.now() - timeNow}ms`,
        );
      }),
    );
  }
}
