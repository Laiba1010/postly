import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

function createContext(cookies: Record<string, string> = {}) {
  const request = { cookies } as any;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  return { context, request };
}

describe('AuthGuard', () => {
  function createGuard() {
    const sessionsService = {
      getSession: jest.fn(),
      getFingerprint: jest.fn(() => 'fingerprint'),
    };
    const usersService = { findById: jest.fn() };
    const guard = new AuthGuard(sessionsService as any, usersService as any);
    return { guard, sessionsService, usersService };
  }

  it('rejects a request without a session cookie', async () => {
    const { guard } = createGuard();
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'UNAUTHENTICATED' },
      status: 401,
    });
  });

  it('rejects an invalid or expired session', async () => {
    const { guard, sessionsService } = createGuard();
    sessionsService.getSession.mockResolvedValue(null);
    const { context } = createContext({ sid: 'invalid-token' });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'UNAUTHENTICATED' },
      status: 401,
    });
    expect(sessionsService.getSession).toHaveBeenCalledWith('invalid-token');
  });

  it('rejects a session whose user no longer exists', async () => {
    const { guard, sessionsService, usersService } = createGuard();
    sessionsService.getSession.mockResolvedValue({ userId: 'user-1' });
    usersService.findById.mockResolvedValue(null);
    const { context } = createContext({ sid: 'valid-token' });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'UNAUTHENTICATED' },
      status: 401,
    });
  });

  it('attaches the authenticated user and session fingerprint', async () => {
    const { guard, sessionsService, usersService } = createGuard();
    sessionsService.getSession.mockResolvedValue({ userId: 'user-1' });
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      name: 'Laiba',
      email: 'laiba@example.com',
    });
    const { context, request } = createContext({ sid: 'valid-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-1',
      name: 'Laiba',
      email: 'laiba@example.com',
    });
    expect(request.sessionFingerprint).toBe('fingerprint');
  });
});
