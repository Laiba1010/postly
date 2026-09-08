import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { SocialConnectionsService } from './social-connections.service';

@Controller('workspaces/:workspaceId/social-connections')
@UseGuards(AuthGuard, WorkspaceGuard)
export class SocialConnectionsController {
  constructor(
    private readonly socialConnectionsService: SocialConnectionsService,
  ) {}

  @Get()
  async list(@Param('workspaceId') workspaceId: string) {
    const connections =
      await this.socialConnectionsService.listForWorkspace(workspaceId);
    return { connections };
  }

  @Delete(':connectionId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.EDITOR)
  async disconnect(
    @Param('workspaceId') workspaceId: string,
    @Param('connectionId') connectionId: string,
  ) {
    await this.socialConnectionsService.disconnect(workspaceId, connectionId);
    return { success: true };
  }
}
