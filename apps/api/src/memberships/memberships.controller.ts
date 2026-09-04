import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/auth.service';
import { MembershipsService } from './memberships.service';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Controller('workspaces/:workspaceId/members')
@UseGuards(AuthGuard, WorkspaceGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  async list(@Param('workspaceId') workspaceId: string) {
    const members = await this.membershipsService.listMembers(workspaceId);
    return { members };
  }

  @Patch(':membershipId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  async updateRole(
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: PublicUser,
  ) {
    const member = await this.membershipsService.updateMemberRole(
      workspaceId,
      membershipId,
      dto.role,
      user.id,
    );
    return { member };
  }

  @Delete(':membershipId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: PublicUser,
  ) {
    await this.membershipsService.removeMember(
      workspaceId,
      membershipId,
      user.id,
    );
    return { success: true };
  }
}
