import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    _id: 'user-1',
    name: 'Laiba',
    email: 'laiba@example.com',
    passwordHash: 'argon-hash',
  };

  function createService(overrides: Record<string, unknown> = {}) {
    const usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      updatePassword: jest.fn(),
    };
    const passwordService = {
      hash: jest.fn(async (password: string) => `hash:${password}`),
      verify: jest.fn(),
    };
    const sessionsService = {
      createSession: jest.fn(async () => 'session-token'),
      deleteSession: jest.fn(),
      invalidateUserSessions: jest.fn(),
    };
    const passwordResetModel = {
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    const connection = { startSession: jest.fn() };
    const configService = { get: jest.fn(() => 'test') };

    const service = new AuthService(
      usersService as any,
      passwordService as any,
      sessionsService as any,
      connection as any,
      passwordResetModel as any,
      configService as any,
    );

    Object.assign(usersService, overrides.usersService ?? {});
    Object.assign(passwordService, overrides.passwordService ?? {});
    Object.assign(sessionsService, overrides.sessionsService ?? {});
    Object.assign(passwordResetModel, overrides.passwordResetModel ?? {});
    Object.assign(connection, overrides.connection ?? {});
    Object.assign(configService, overrides.configService ?? {});

    return {
      service,
      usersService,
      passwordService,
      sessionsService,
      passwordResetModel,
      connection,
      configService,
    };
  }

  it('signs up a new user and creates a session', async () => {
    const { service, usersService, passwordService, sessionsService } =
      createService();
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockResolvedValue(user);

    await expect(
      service.signup('Laiba', ' LAIBA@EXAMPLE.COM ', 'Password123'),
    ).resolves.toEqual({
      sessionId: 'session-token',
      user: {
        id: 'user-1',
        name: 'Laiba',
        email: 'laiba@example.com',
      },
    });

    expect(passwordService.hash).toHaveBeenCalledWith('Password123');
    expect(usersService.create).toHaveBeenCalledWith(
      'Laiba',
      'laiba@example.com',
      'hash:Password123',
    );
    expect(sessionsService.createSession).toHaveBeenCalledWith('user-1');
  });

  it('rejects an already registered email before creating a user', async () => {
    const { service, usersService } = createService();
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      service.signup('Other', 'LAIBA@EXAMPLE.COM', 'Password123'),
    ).rejects.toMatchObject({
      response: {
        code: 'EMAIL_ALREADY_EXISTS',
      },
      status: 409,
    });
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('maps a concurrent duplicate-key signup to EMAIL_ALREADY_EXISTS', async () => {
    const { service, usersService } = createService();
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockRejectedValue({ code: 11000 });

    await expect(
      service.signup('Laiba', 'laiba@example.com', 'Password123'),
    ).rejects.toMatchObject({
      response: {
        code: 'EMAIL_ALREADY_EXISTS',
      },
      status: 409,
    });
  });

  it('rethrows non-duplicate signup errors', async () => {
    const { service, usersService } = createService();
    const error = new Error('database unavailable');
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockRejectedValue(error);

    await expect(
      service.signup('Laiba', 'laiba@example.com', 'Password123'),
    ).rejects.toBe(error);
  });

  it('logs in with valid credentials', async () => {
    const { service, usersService, passwordService, sessionsService } =
      createService();
    usersService.findByEmail.mockResolvedValue(user);
    passwordService.verify.mockResolvedValue(true);

    await expect(
      service.login(' LAIBA@EXAMPLE.COM ', 'Password123'),
    ).resolves.toEqual({
      sessionId: 'session-token',
      user: {
        id: 'user-1',
        name: 'Laiba',
        email: 'laiba@example.com',
      },
    });
    expect(sessionsService.createSession).toHaveBeenCalledWith('user-1');
  });

  it('rejects login when the user does not exist', async () => {
    const { service, usersService } = createService();
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login('missing@example.com', 'Password123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login when the password is incorrect', async () => {
    const { service, usersService, passwordService } = createService();
    usersService.findByEmail.mockResolvedValue(user);
    passwordService.verify.mockResolvedValue(false);

    await expect(
      service.login('laiba@example.com', 'WrongPassword'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logs out by deleting the session', async () => {
    const { service, sessionsService } = createService();

    await service.logout('session-token');

    expect(sessionsService.deleteSession).toHaveBeenCalledWith('session-token');
  });

  it('creates a password reset record without revealing account existence', async () => {
    const { service, usersService, passwordResetModel } = createService();
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      service.forgotPassword(' LAIBA@EXAMPLE.COM '),
    ).resolves.toBeUndefined();
    expect(passwordResetModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    );
  });

  it('does nothing for a password reset request for an unknown email', async () => {
    const { service, usersService, passwordResetModel } = createService();
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.forgotPassword('missing@example.com'),
    ).resolves.toBeUndefined();
    expect(passwordResetModel.create).not.toHaveBeenCalled();
  });

  it('resets a password, consumes the token, and invalidates sessions', async () => {
    const {
      service,
      passwordService,
      sessionsService,
      passwordResetModel,
      usersService,
      connection,
    } = createService();

    const resetRecord = { userId: { toString: () => 'user-1' } };
    const transactionSession = { endSession: jest.fn() };
    passwordResetModel.findOneAndUpdate.mockResolvedValue(resetRecord);
    usersService.updatePassword.mockResolvedValue(true);
    connection.startSession.mockResolvedValue({
      withTransaction: async (callback: () => Promise<void>) => callback(),
      endSession: transactionSession.endSession,
    });

    await expect(
      service.resetPassword('raw-token', 'NewPassword123'),
    ).resolves.toBeUndefined();

    expect(passwordService.hash).toHaveBeenCalledWith('NewPassword123');
    expect(passwordResetModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ usedAt: null }),
      expect.objectContaining({
        $set: expect.objectContaining({ usedAt: expect.any(Date) }),
      }),
      expect.objectContaining({ new: false, session: expect.anything() }),
    );
    expect(usersService.updatePassword).toHaveBeenCalledWith(
      'user-1',
      'hash:NewPassword123',
      expect.anything(),
    );
    expect(sessionsService.invalidateUserSessions).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('rejects an invalid or expired reset token', async () => {
    const { service, passwordResetModel, connection } = createService();
    passwordResetModel.findOneAndUpdate.mockResolvedValue(null);
    connection.startSession.mockResolvedValue({
      withTransaction: async (callback: () => Promise<void>) => callback(),
      endSession: jest.fn(),
    });

    await expect(
      service.resetPassword('bad-token', 'NewPassword123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
