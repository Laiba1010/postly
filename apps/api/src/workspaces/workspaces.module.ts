import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workspace, WorkspaceSchema } from './schemas/workspace.schema';
import { MembershipsModule } from '../memberships/memberships.module';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceGuard } from './guards/workspace.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    forwardRef(() => MembershipsModule), // <--- Added forwardRef
    AuthModule,
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceGuard],
  exports: [WorkspacesService, WorkspaceGuard],
})
export class WorkspacesModule {}
