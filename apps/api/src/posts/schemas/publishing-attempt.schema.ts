import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { PublishingAttemptStatus } from '../enums/publishing-attempt-status.enum';
import { PublishFailureReason } from '../../mock-platform/enums/publish-failure-reason.enum';

export type PublishingAttemptDocument = HydratedDocument<PublishingAttempt> & {
  createdAt: Date;
};

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class PublishingAttempt {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'PostTarget',
    required: true,
    index: true,
  })
  postTargetId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  attemptNumber: number;

  @Prop({ type: String, enum: PublishingAttemptStatus, required: true })
  status: PublishingAttemptStatus;

  @Prop({ type: String, enum: PublishFailureReason, default: null })
  errorCode: PublishFailureReason | null;

  @Prop({ default: null })
  errorMessage: string | null;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ default: null })
  completedAt: Date | null;
}

export const PublishingAttemptSchema =
  SchemaFactory.createForClass(PublishingAttempt);

PublishingAttemptSchema.index(
  { postTargetId: 1, attemptNumber: 1 },
  { unique: true },
);

/** Supports recovery of attempts left open by a worker crash. */
PublishingAttemptSchema.index({ postTargetId: 1, status: 1 });
