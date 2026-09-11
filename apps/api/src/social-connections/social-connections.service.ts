import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  SocialConnection,
  SocialConnectionDocument,
} from './schemas/social-connection.schema';
import { SocialProvider } from './enums/provider.enum';
import { ConnectionStatus } from './enums/connection-status.enum';
import { TokenEncryptionService } from './token-encryption.service';

export interface SocialConnectionSummary {
  id: string;
  provider: SocialProvider;
  accountId: string;
  accountName: string;
  status: ConnectionStatus;
  isExpired: boolean;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class SocialConnectionsService {
  constructor(
    @InjectModel(SocialConnection.name)
    private readonly connectionModel: Model<SocialConnectionDocument>,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async listForWorkspace(
    workspaceId: string,
  ): Promise<SocialConnectionSummary[]> {
    const connections = await this.connectionModel
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ createdAt: -1 })
      .exec();

    return connections.map((c) => this.toSummary(c));
  }

  async createConnection(params: {
    workspaceId: string;
    provider: SocialProvider;
    accountId: string;
    accountName: string;
  }): Promise<SocialConnectionSummary> {
    const existing = await this.connectionModel.findOne({
      workspaceId: new Types.ObjectId(params.workspaceId),
      provider: params.provider,
      accountId: params.accountId,
    });

    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_CONNECTED',
        message: 'This account is already connected to this workspace',
      });
    }

    const mockAccessToken = `mock-access-${params.provider}-${params.accountId}`;
    const mockRefreshToken = `mock-refresh-${params.provider}-${params.accountId}`;

    try {
      const connection = await this.connectionModel.create({
        workspaceId: new Types.ObjectId(params.workspaceId),
        provider: params.provider,
        accountId: params.accountId,
        accountName: params.accountName,
        accessTokenEncrypted: this.tokenEncryption.encrypt(mockAccessToken),
        refreshTokenEncrypted: this.tokenEncryption.encrypt(mockRefreshToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
      });

      return this.toSummary(connection);
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException({
          code: 'ALREADY_CONNECTED',
          message: 'This account is already connected to this workspace',
        });
      }
      throw err;
    }
  }

  async disconnect(workspaceId: string, connectionId: string): Promise<void> {
    const result = await this.connectionModel.deleteOne({
      _id: connectionId,
      workspaceId: new Types.ObjectId(workspaceId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException({
        code: 'CONNECTION_NOT_FOUND',
        message: 'Social connection not found',
      });
    }
  }
  private toSummary(c: SocialConnectionDocument): SocialConnectionSummary {
    return {
      id: c._id.toString(),
      provider: c.provider,
      accountId: c.accountId,
      accountName: c.accountName,
      status: c.status,
      isExpired: c.expiresAt < new Date(),
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
    };
  }
}
