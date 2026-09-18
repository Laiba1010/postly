import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password/password.service';
import { SessionsService } from '../sessions/sessions.service';
import {
  PasswordReset,
  PasswordResetDocument,
} from './schemas/password-reset.schema';
import { randomBytes, createHash } from 'crypto';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly sessionsService: SessionsService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(PasswordReset.name)
    private readonly passwordResetModel: Model<PasswordResetDocument>,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) return;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await this.passwordResetModel.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    const resetLink = `http://localhost:3000/reset-password?token=${rawToken}`;

    // TODO: replace with real email sending (out of MVP scope per spec).
    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(
        `[DEV ONLY] Password reset link for ${normalizedEmail}: ${resetLink}`,
      );
    }
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const passwordHash = await this.passwordService.hash(newPassword);
    const session = await this.connection.startSession();
    let resetUserId: string | undefined;

    try {
      await session.withTransaction(async () => {
        // Claim the token and update the password in one Mongo transaction.
        // This prevents concurrent replay and avoids leaving a claimed token
        // behind if the password write fails.
        const resetRecord = await this.passwordResetModel.findOneAndUpdate(
          {
            tokenHash,
            usedAt: null,
            expiresAt: { $gt: new Date() },
          },
          { $set: { usedAt: new Date() } },
          { new: false, session },
        );

        if (!resetRecord) {
          throw new UnauthorizedException({
            code: 'INVALID_RESET_TOKEN',
            message: 'This password reset link is invalid or has expired',
          });
        }

        resetUserId = resetRecord.userId.toString();

        const updated = await this.usersService.updatePassword(
          resetRecord.userId.toString(),
          passwordHash,
          session,
        );

        if (!updated) {
          throw new UnauthorizedException({
            code: 'USER_NOT_FOUND',
            message: 'Unable to reset password for this account',
          });
        }
      });
    } finally {
      await session.endSession();
    }

    // Session auth is Redis-backed. Incrementing the user's session version
    // makes every previously issued session invalid on its next request.
    if (!resetUserId) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'Unable to reset password for this account',
      });
    }

    await this.sessionsService.invalidateUserSessions(resetUserId);
  }

  async signup(name: string, email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await this.usersService.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    const passwordHash = await this.passwordService.hash(password);
    let user;
    try {
      user = await this.usersService.create(
        name,
        normalizedEmail,
        passwordHash,
      );
    } catch (error) {
      // The pre-check above is not sufficient under concurrent signups.
      // The unique MongoDB email index remains the final source of truth.
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists',
        });
      }
      throw error;
    }

    const sessionId = await this.sessionsService.createSession(
      user.id.toString(),
    );

    return { sessionId, user: this.toPublicUser(user) };
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const isValid = await this.passwordService.verify(
      user.passwordHash,
      password,
    );
    if (!isValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const sessionId = await this.sessionsService.createSession(
      user.id.toString(),
    );

    return { sessionId, user: this.toPublicUser(user) };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionsService.deleteSession(sessionId);
  }

  private toPublicUser(user: {
    id: any;
    name: string;
    email: string;
  }): PublicUser {
    return {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
    };
  }
}
