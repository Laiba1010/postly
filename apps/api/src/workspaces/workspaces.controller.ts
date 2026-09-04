import { Body, Controller, Get, Post, UseGuards, Param } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/auth.service';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';

import { WorkspaceGuard } from './guards/workspace.guard';
import { CurrentWorkspace } from './decorators/current-workspace.decorator';
import type { WorkspaceWithRole } from './workspaces.service';

@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  async create(
    @CurrentUser() user: PublicUser,
    @Body() dto: CreateWorkspaceDto,
  ) {
    const workspace = await this.workspacesService.createWorkspace(
      user.id,
      dto.name,
    );
    return { workspace };
  }

  @Get()
  async list(@CurrentUser() user: PublicUser) {
    const workspaces = await this.workspacesService.listForUser(user.id);
    return { workspaces };
  }
  @Get(':workspaceId')
  @UseGuards(WorkspaceGuard)
  async getOne(@CurrentWorkspace() workspace: WorkspaceWithRole) {
    return { workspace };
  }
}
