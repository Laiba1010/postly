import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { SocialProvider } from '../../social-connections/enums/provider.enum';
import { PostTargetStatus } from '../enums/post-target-status.enum';

export type PostTargetDocument = HydratedDocument<PostTarget> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class PostTarget {
  @Prop({
    type: Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true,
  })
  postId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Workspace',
    required: true,
  })
  workspaceId: Types.ObjectId;

  @Prop({
    type: String,
    enum: SocialProvider,
    required: true,
  })
  platform: SocialProvider;

  @Prop({
    type: Types.ObjectId,
    ref: 'SocialConnection',
    required: true,
  })
  socialConnectionId: Types.ObjectId;

  @Prop({
    type: String,
    enum: PostTargetStatus,
    default: PostTargetStatus.SCHEDULED,
  })
  status: PostTargetStatus;

  @Prop({ required: true })
  scheduledAt: Date;
}

export const PostTargetSchema = SchemaFactory.createForClass(PostTarget);

/**
 * Prevent duplicate targets for the same social connection.
 *
 * This is a database invariant, not merely an application-level check.
 */
PostTargetSchema.index({ postId: 1, socialConnectionId: 1 }, { unique: true });

/**
 * Supports:
 * listTargetsForPost(workspaceId, postId)
 */
PostTargetSchema.index({
  workspaceId: 1,
  postId: 1,
});

/**
 * Useful for Phase 8 worker queries.
 */
PostTargetSchema.index({
  workspaceId: 1,
  status: 1,
});
