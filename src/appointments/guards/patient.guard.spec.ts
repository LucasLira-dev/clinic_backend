import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PatientGuard } from './patient.guard';
import { auth } from '../../auth/auth.config';

jest.mock('../../auth/auth.config', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

describe('PatientGuard', () => {
  const getSessionMock = auth.api.getSession as jest.Mock;

  const createExecutionContext = (headers: Record<string, string> = {}) => {
    const request: {
      headers: Record<string, string>;
      user?: { id: string; role: string };
    } = {
      headers,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    } as unknown as ExecutionContext & {
      request: {
        headers: Record<string, string>;
        user?: { id: string; role: string };
      };
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws UnauthorizedException when session is missing', async () => {
    const guard = new PatientGuard();
    const context = createExecutionContext();

    getSessionMock.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws ForbiddenException when user role is not patient', async () => {
    const guard = new PatientGuard();
    const context = createExecutionContext();

    getSessionMock.mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'doctor',
      },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows request when role is patient and injects user into request', async () => {
    const guard = new PatientGuard();
    const context = createExecutionContext({ cookie: 'session=abc' });

    getSessionMock.mockResolvedValue({
      user: {
        id: 'patient-1',
        role: 'patient',
      },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((context as any).request.user).toEqual({
      id: 'patient-1',
      role: 'patient',
    });
  });
});
