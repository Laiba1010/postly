import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PostStatus } from '../enums/post-status.enum';
import {
  PostDestination,
  PostDestinationSchema,
} from './post-destination.schema';

export type PostDocument = HydratedDocument<Post> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  authorId: Types.ObjectId;

  @Prop({ default: '' })
  content: string;

  @Prop({
    type: String,
    enum: PostStatus,
    default: PostStatus.DRAFT,
    index: true,
  })
  status: PostStatus;

  @Prop({ type: [PostDestinationSchema], default: [] })
  destinations: PostDestination[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Media' }], default: [] })
  mediaIds: Types.ObjectId[];

  // Unused in Phase 6 — reserved exactly as the architecture defines them
  // for Phase 7's scheduling step. Left null until then.
  @Prop({ type: Date, default: null })
  scheduledAt: Date | null;

  @Prop({ type: String, default: null })
  timezone: string | null;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ workspaceId: 1, status: 1 });
PostSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });
PostSchema.index({ workspaceId: 1, createdAt: -1 });
PostSchema.index({ workspaceId: 1, scheduledAt: 1, status: 1 });
