import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { WorkspaceWithRole } from '../workspaces.service';

export const CurrentWorkspace = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): WorkspaceWithRole => {
    const request = ctx.switchToHttp().getRequest();
    return request.workspace;
  },
);
