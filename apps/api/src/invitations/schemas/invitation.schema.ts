import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type InvitationDocument = HydratedDocument<Invitation>;

@Schema({ timestamps: true })
export class Invitation {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, enum: Role, required: true })
  role: Role;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedBy: Types.ObjectId;

  @Prop({ default: null })
  acceptedAt: Date | null;

  @Prop({ default: null })
  revokedAt: Date | null;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);

// One pending invitation per email per workspace — enforced at the DB level
// via a partial index so multiple *accepted* invitations for the same
// email/workspace pair (from past re-invites) don't collide.
InvitationSchema.index(
  { workspaceId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { acceptedAt: null, revokedAt: null },
  },
);
