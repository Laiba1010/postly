import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type MembershipDocument = HydratedDocument<Membership>;

@Schema({ timestamps: true })
export class Membership {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: Role, required: true })
  role: Role;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

// A user must never have two memberships in the same workspace
MembershipSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });
