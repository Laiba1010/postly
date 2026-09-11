import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workspace, WorkspaceSchema } from './schemas/workspace.schema';
import { MembershipsModule } from '../memberships/memberships.module';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceGuard } from './guards/workspace.guard';
import {
  SocialConnection,
  SocialConnectionSchema,
} from '../social-connections/schemas/social-connection.schema';
import {
  Invitation,
  InvitationSchema,
} from '../invitations/schemas/invitation.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: SocialConnection.name, schema: SocialConnectionSchema },
      { name: Invitation.name, schema: InvitationSchema },
    ]),
    forwardRef(() => MembershipsModule), // <--- Added forwardRef
    AuthModule,
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceGuard],
  exports: [WorkspacesService, WorkspaceGuard, MongooseModule],
})
export class WorkspacesModule {}
