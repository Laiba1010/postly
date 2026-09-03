import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password/password.service';
import { SessionsService } from '../sessions/sessions.service';
import { InjectModel } from '@nestjs/mongoose';
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
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly sessionsService: SessionsService,
    @InjectModel(PasswordReset.name)
    private readonly passwordResetModel: Model<PasswordResetDocument>,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    // Always behave the same way whether or not the user exists —
    // prevents account enumeration via this endpoint too.
    if (!user) return;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

    await this.passwordResetModel.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    const resetLink = `http://localhost:3000/reset-password?token=${rawToken}`;

    // TODO: replace with real email sending (out of MVP scope per spec).
    // Logged here so the flow is testable end-to-end in development.
    console.log(
      `[DEV ONLY] Password reset link for ${normalizedEmail}: ${resetLink}`,
    );
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);

    const resetRecord = await this.passwordResetModel.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      throw new UnauthorizedException({
        code: 'INVALID_RESET_TOKEN',
        message: 'This password reset link is invalid or has expired',
      });
    }

    const passwordHash = await this.passwordService.hash(newPassword);
    await this.usersService.updatePassword(
      resetRecord.userId.toString(),
      passwordHash,
    );

    resetRecord.usedAt = new Date();
    await resetRecord.save();
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
    const user = await this.usersService.create(
      name,
      normalizedEmail,
      passwordHash,
    );

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
