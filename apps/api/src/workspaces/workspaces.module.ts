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
import { Post, PostSchema } from '../posts/schemas/post.schema';
import {
  PostTarget,
  PostTargetSchema,
} from '../posts/schemas/post-target.schema';
import {
  PublishingAttempt,
  PublishingAttemptSchema,
} from '../posts/schemas/publishing-attempt.schema';
import { Media, MediaSchema } from '../media/schemas/media.schema';
import { QueueModule } from '../queue/queue.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: SocialConnection.name, schema: SocialConnectionSchema },
      { name: Invitation.name, schema: InvitationSchema },
      { name: Post.name, schema: PostSchema },
      { name: PostTarget.name, schema: PostTargetSchema },
      { name: PublishingAttempt.name, schema: PublishingAttemptSchema },
      { name: Media.name, schema: MediaSchema },
    ]),
    forwardRef(() => MembershipsModule),
    AuthModule,
    QueueModule,
    forwardRef(() => MediaModule),
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceGuard],
  exports: [WorkspacesService, WorkspaceGuard, MongooseModule],
})
export class WorkspacesModule {}
