import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no @Roles() decorator means no restriction beyond membership
    }

    const request = context.switchToHttp().getRequest();
    const workspace = request.workspace; // attached by WorkspaceGuard, which must run first

    if (!workspace || !requiredRoles.includes(workspace.role)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'You do not have permission to perform this action',
      });
    }

    return true;
  }
}
