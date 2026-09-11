import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MediaType } from '../enums/media-type.enum';

export type MediaDocument = HydratedDocument<Media> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ _id: false })
export class MediaMetadata {
  @Prop({ type: Number })
  width?: number;

  @Prop({ type: Number })
  height?: number;

  @Prop({ type: Number })
  aspectRatio?: number;
}

export const MediaMetadataSchema = SchemaFactory.createForClass(MediaMetadata);

@Schema({ timestamps: true })
export class Media {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  uploadedBy: Types.ObjectId;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  storageKey: string;

  @Prop({ type: String, enum: MediaType, required: true })
  mediaType: MediaType;

  // null = not yet attached to any saved post (an "orphan candidate").
  // Set once a draft referencing this media is actually saved.
  @Prop({ type: Types.ObjectId, ref: 'Post', default: null, index: true })
  postId: Types.ObjectId | null;

  @Prop({ type: MediaMetadataSchema, default: null })
  metadata?: MediaMetadata;
}

export const MediaSchema = SchemaFactory.createForClass(Media);

MediaSchema.index({ workspaceId: 1, createdAt: -1 });
// Supports the cleanup sweep's exact query pattern (find old, unattached media).
MediaSchema.index({ postId: 1, createdAt: 1 });
