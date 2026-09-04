import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { WorkspacesService } from '../workspaces.service';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly workspacesService: WorkspacesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user; // populated by AuthGuard, which must run first
    const workspaceId = request.params.workspaceId;

    if (!workspaceId) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace not found',
      });
    }

    const workspace = await this.workspacesService.getWorkspaceContext(
      user.id,
      workspaceId as string,
    );

    if (!workspace) {
      // Deliberately the same error whether the workspace doesn't exist
      // or the user isn't a member — don't leak which case it is.
      throw new ForbiddenException({
        code: 'NOT_A_MEMBER',
        message: 'You do not have access to this workspace',
      });
    }

    (request as any).workspace = workspace;
    return true;
  }
}
