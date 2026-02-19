import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { auth } from '../../auth/auth.config';

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: any }>();

    try {
      // Obter a sessão do better-auth
      const session = await auth.api.getSession({
        headers: request.headers as Record<string, string>,
      });

      if (!session || !session.user) {
        throw new UnauthorizedException('Usuário não autenticado');
      }

      // Verificar se o usuário tem role admin
      const userRole = session.user.role;

      if (userRole !== 'admin') {
        throw new ForbiddenException(
          'Acesso negado. Apenas administradores podem acessar este recurso.',
        );
      }

      // Adicionar o usuário ao request para uso posterior
      request.user = session.user;

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
