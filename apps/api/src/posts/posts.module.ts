import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from './schemas/post.schema';
import { PostTarget, PostTargetSchema } from './schemas/post-target.schema';
import {
  SocialConnection,
  SocialConnectionSchema,
} from '../social-connections/schemas/social-connection.schema';
import { Media, MediaSchema } from '../media/schemas/media.schema';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostTarget.name, schema: PostTargetSchema },
      { name: SocialConnection.name, schema: SocialConnectionSchema },
      { name: Media.name, schema: MediaSchema },
    ]),
    AuthModule,
    WorkspacesModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [MongooseModule],
})
export class PostsModule {}
