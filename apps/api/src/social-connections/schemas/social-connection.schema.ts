import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SocialProvider } from '../enums/provider.enum';
import { ConnectionStatus } from '../enums/connection-status.enum';

export type SocialConnectionDocument = HydratedDocument<SocialConnection> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class SocialConnection {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: SocialProvider, required: true })
  provider: SocialProvider;

  @Prop({ required: true })
  accountId: string;

  @Prop({ required: true })
  accountName: string;

  @Prop({ required: true, select: false })
  accessTokenEncrypted: string;

  @Prop({ required: true, select: false })
  refreshTokenEncrypted: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({
    type: String,
    enum: ConnectionStatus,
    default: ConnectionStatus.ACTIVE,
  })
  status: ConnectionStatus;
}

export const SocialConnectionSchema =
  SchemaFactory.createForClass(SocialConnection);

// Prevents true duplicates while allowing multiple accounts per provider.
// This is the actual integrity guarantee — application-level pre-checks
// are a fast-path convenience only, not a substitute for this constraint.
SocialConnectionSchema.index(
  { workspaceId: 1, provider: 1, accountId: 1 },
  { unique: true },
);

// Supports the primary "list connections for a workspace, newest first"
// query pattern. Replaces the earlier standalone { workspaceId: 1 } index,
// which the compound index above already partially covered but without
// supporting the createdAt sort.
SocialConnectionSchema.index({ workspaceId: 1, createdAt: -1 });
