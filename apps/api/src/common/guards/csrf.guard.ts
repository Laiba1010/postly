import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigin: string;

  constructor(configService: ConfigService) {
    const configuredOrigin = configService.get<string>('CORS_ORIGIN');
    if (!configuredOrigin) {
      throw new Error('CORS_ORIGIN is required for CSRF protection');
    }

    try {
      this.allowedOrigin = new URL(configuredOrigin).origin;
    } catch {
      throw new Error('CORS_ORIGIN must be a valid absolute URL');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!UNSAFE_METHODS.has(request.method)) return true;

    const origin = request.headers.origin;
    const referer = request.headers.referer;

    if (origin) {
      if (this.normalizeOrigin(origin) !== this.allowedOrigin) {
        throw this.originMismatch();
      }
      return true;
    }

    if (referer) {
      try {
        if (new URL(referer).origin === this.allowedOrigin) return true;
      } catch {
        // Treat malformed Referer as untrusted.
      }
    }

    throw this.originMismatch();
  }

  private normalizeOrigin(value: string): string | null {
    try {
      return new URL(value).origin;
    } catch {
      return null;
    }
  }

  private originMismatch(): ForbiddenException {
    return new ForbiddenException({
      code: 'CSRF_ORIGIN_MISMATCH',
      message: 'Request origin not allowed',
    });
  }
}
