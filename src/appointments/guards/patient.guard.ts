import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { auth } from '../../auth/auth.config';

@Injectable()
export class PatientGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { id: string; role: string } }>();

    try {
      const session = await auth.api.getSession({
        headers: request.headers as Record<string, string>,
      });

      if (!session?.user) {
        throw new UnauthorizedException('Usuário não autenticado');
      }

      if (session.user.role !== 'patient' && session.user.role !== 'admin') {
        throw new ForbiddenException(
          'Acesso negado. Apenas pacientes podem acessar este recurso.',
        );
      }

      request.user = {
        id: session.user.id,
        role: session.user.role,
      };

      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new UnauthorizedException('Falha na autenticação');
    }
  }
}
