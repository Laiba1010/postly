import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .exec();
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
    session?: ClientSession,
  ): Promise<boolean> {
    const result = await this.userModel.updateOne(
      { _id: userId },
      { $set: { passwordHash } },
      session ? { session } : undefined,
    );
    return result.modifiedCount === 1;
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async create(
    name: string,
    email: string,
    passwordHash: string,
  ): Promise<UserDocument> {
    const user = new this.userModel({
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
    });
    return user.save();
  }
}
