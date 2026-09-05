import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/auth.service';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('workspaces/:workspaceId/invitations')
  @UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
  @Roles(Role.OWNER)
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: PublicUser,
  ) {
    const { invitation } = await this.invitationsService.createInvitation(
      workspaceId,
      user.id,
      dto.email,
      dto.role,
    );
    return { invitation };
  }

  @Get('workspaces/:workspaceId/invitations')
  @UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
  @Roles(Role.OWNER)
  async listPending(@Param('workspaceId') workspaceId: string) {
    const invitations =
      await this.invitationsService.listPendingForWorkspace(workspaceId);
    return { invitations };
  }

  @Get('invitations/:token/preview')
  async preview(@Param('token') token: string) {
    const invitation = await this.invitationsService.previewByToken(token);
    return { invitation };
  }

  @Post('invitations/:token/accept')
  @UseGuards(AuthGuard)
  async accept(@Param('token') token: string, @CurrentUser() user: PublicUser) {
    await this.invitationsService.acceptInvitation(token, user.id, user.email);
    return { success: true };
  }
}
