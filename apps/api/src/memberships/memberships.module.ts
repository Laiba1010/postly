import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Membership, MembershipSchema } from './schemas/membership.schema';
import { MembershipsService } from './memberships.service';
import { MembershipsController } from './memberships.controller';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Membership.name, schema: MembershipSchema },
    ]),
    AuthModule,
    forwardRef(() => WorkspacesModule), // <--- Added forwardRef
  ],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MongooseModule, MembershipsService],
})
export class MembershipsModule {}
