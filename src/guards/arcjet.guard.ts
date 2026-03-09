import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ARCJET } from '@arcjet/nest';
import type { ArcjetNest } from '@arcjet/nest';

@Injectable()
export class CustomArcjetGuard implements CanActivate {
  constructor(@Inject(ARCJET) private readonly aj: ArcjetNest) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (!request) {
      return true;
    }

    const decision = await this.aj.protect(request);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              'Limite de requisições atingido. Tente novamente em breve.',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (decision.reason.isBot()) {
        throw new ForbiddenException(
          'Acesso negado: tráfego automatizado detectado.',
        );
      }

      if (decision.reason.isShield()) {
        throw new ForbiddenException(
          'Acesso negado: requisição bloqueada por segurança.',
        );
      }

      throw new ForbiddenException('Acesso negado.');
    }

    return true;
  }
}
