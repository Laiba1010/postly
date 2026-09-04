import {
  Body,
  Patch,
  Controller,
  Get,
  Post,
  UseGuards,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/auth.service';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { WorkspaceGuard } from './guards/workspace.guard';
import { CurrentWorkspace } from './decorators/current-workspace.decorator';
import type { WorkspaceWithRole } from './workspaces.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

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
  @Patch(':workspaceId')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(Role.OWNER)
  async update(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentWorkspace() workspace: WorkspaceWithRole,
  ) {
    const updated = await this.workspacesService.updateWorkspace(
      workspaceId,
      dto,
    );
    return { workspace: { ...updated, role: workspace.role } };
  }
}
