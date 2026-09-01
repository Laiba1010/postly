import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password/password.service';
import { SessionsService } from '../sessions/sessions.service';

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
  ) {}

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
