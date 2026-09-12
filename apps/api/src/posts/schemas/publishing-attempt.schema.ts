import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PublishingAttemptStatus } from '../enums/publishing-attempt-status.enum';

export type PublishingAttemptDocument = HydratedDocument<PublishingAttempt> & {
  createdAt: Date;
};

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class PublishingAttempt {
  @Prop({ type: Types.ObjectId, ref: 'PostTarget', required: true })
  postTargetId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  attemptNumber: number;

  @Prop({ type: String, enum: PublishingAttemptStatus, required: true })
  status: PublishingAttemptStatus;

  @Prop({ default: null })
  errorMessage: string | null;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ default: null })
  completedAt: Date | null;
}

export const PublishingAttemptSchema =
  SchemaFactory.createForClass(PublishingAttempt);

// Primary access pattern: full attempt history for one target, in order.
// Database invariant: one attempt number may exist only once per target.
PublishingAttemptSchema.index(
  { postTargetId: 1, attemptNumber: 1 },
  { unique: true },
);
