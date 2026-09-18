import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

import { SocialProvider } from '../../social-connections/enums/provider.enum';
import { PostTargetStatus } from '../enums/post-target-status.enum';

export type PostTargetDocument = HydratedDocument<PostTarget> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class PostTarget {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true,
  })
  postId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
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
    type: MongooseSchema.Types.ObjectId,
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

  /** Number of automatic retries already scheduled for this target. */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  retryCount: number;

  /** When the next automatic retry is due. Null outside RETRYING. */
  @Prop({ type: Date, default: null })
  nextRetryAt: Date | null;

  /** External platform identifier returned after a successful publish. */
  @Prop({ type: String, default: null })
  externalPostId: string | null;
}

export const PostTargetSchema = SchemaFactory.createForClass(PostTarget);

/**
 * Prevent duplicate targets for the same social connection.
 * This is a database invariant, not merely an application-level check.
 */
PostTargetSchema.index({ postId: 1, socialConnectionId: 1 }, { unique: true });

/** Supports listTargetsForPost(workspaceId, postId). */
PostTargetSchema.index({ workspaceId: 1, postId: 1 });

/** Supports worker/reconciliation status queries. */
PostTargetSchema.index({ workspaceId: 1, status: 1 });

/** Supports retry/recovery queries scoped to a post target lifecycle. */
PostTargetSchema.index({ postId: 1, status: 1 });
