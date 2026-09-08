import {
  Body,
  Controller,
  Param,
  ParseEnumPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentSession } from '../auth/decorators/current-session.decorator';
import type { PublicUser } from '../auth/auth.service';
import { OAuthService } from './oauth.service';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import { SocialProvider } from './enums/provider.enum';

@Controller()
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Post('workspaces/:workspaceId/social-connections/oauth/:provider/start')
  @UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
  @Roles(Role.OWNER, Role.EDITOR)
  async start(
    @Param('workspaceId') workspaceId: string,
    @Param('provider', new ParseEnumPipe(SocialProvider))
    provider: SocialProvider,
    @CurrentUser() user: PublicUser,
    @CurrentSession() sessionFingerprint: string,
  ) {
    return this.oauthService.startConnection(
      user.id,
      workspaceId,
      provider,
      sessionFingerprint,
    );
  }

  @Post('oauth/callback')
  @UseGuards(AuthGuard)
  async callback(
    @Body() dto: OAuthCallbackDto,
    @CurrentUser() user: PublicUser,
    @CurrentSession() sessionFingerprint: string,
  ) {
    return this.oauthService.completeConnection(dto, user, sessionFingerprint);
  }
}
