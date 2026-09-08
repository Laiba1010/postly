import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SocialConnection,
  SocialConnectionSchema,
} from './schemas/social-connection.schema';
import { TokenEncryptionService } from './token-encryption.service';
import { SocialConnectionsService } from './social-connections.service';
import { SocialConnectionsController } from './social-connections.controller';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { ProviderRegistry } from './providers/provider.registry';
import { InstagramProvider } from './providers/instagram.provider';
import { FacebookProvider } from './providers/facebook.provider';
import { LinkedInProvider } from './providers/linkedin.provider';
import { XProvider } from './providers/x.provider';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SocialConnection.name, schema: SocialConnectionSchema },
    ]),
    AuthModule,
    WorkspacesModule,
  ],
  controllers: [SocialConnectionsController, OAuthController],
  providers: [
    TokenEncryptionService,
    SocialConnectionsService,
    OAuthService,
    ProviderRegistry,
    InstagramProvider,
    FacebookProvider,
    LinkedInProvider,
    XProvider,
  ],
})
export class SocialConnectionsModule {}
