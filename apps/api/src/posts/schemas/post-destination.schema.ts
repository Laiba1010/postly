import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SocialProvider } from '../../social-connections/enums/provider.enum';

@Schema({ _id: false })
export class PostDestination {
  @Prop({ type: String, enum: SocialProvider, required: true })
  provider: SocialProvider;

  @Prop({ type: Types.ObjectId, ref: 'SocialConnection', required: true })
  socialConnectionId: Types.ObjectId;

  // Denormalized snapshot for display only (avoids a join just to render
  // "Instagram — @brand" in the composer/preview). socialConnectionId
  // remains the actual source of truth and is what Phase 7 will use to
  // create PostTargets.
  @Prop({ required: true })
  accountName: string;
}

export const PostDestinationSchema =
  SchemaFactory.createForClass(PostDestination);
