import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionsService } from '../../sessions/sessions.service';
import { UsersService } from '../../users/users.service';

const SESSION_COOKIE_NAME = 'sid';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.cookies?.[SESSION_COOKIE_NAME];

    if (!sessionId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
    }

    const session = await this.sessionsService.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Session expired or invalid',
      });
    }

    const user = await this.usersService.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'User not found',
      });
    }

    // Attach to request so controllers/handlers can access it
    (request as any).user = {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
    };

    return true;
  }
}
