import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const UNSAFE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!UNSAFE_METHODS.includes(request.method)) {
      return true;
    }

    const allowedOrigin = this.configService.get<string>('CORS_ORIGIN');
    const origin = request.headers.origin ?? request.headers.referer;

    if (!origin || !origin.startsWith(allowedOrigin!)) {
      throw new ForbiddenException({
        code: 'CSRF_ORIGIN_MISMATCH',
        message: 'Request origin not allowed',
      });
    }

    return true;
  }
}
