import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { MongooseModule } from '@nestjs/mongoose';
import Redis from 'ioredis';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { PasswordModule } from './auth/password/password.module';
import { SessionsModule } from './sessions/sessions.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { InvitationsModule } from './invitations/invitations.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PostsModule } from './posts/posts.module';
import { MediaModule } from './media/media.module';
import { SocialConnectionsModule } from './social-connections/social-connections.module';
import { QueueModule } from './queue/queue.module';

import { REDIS_CLIENT } from './redis/redis.module';
import { RedisThrottlerStorage } from './common/rate-limit/redis-throttler.storage';

// add to imports array

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().uri().required(),
        REDIS_URL: Joi.string().uri().required(),
        SESSION_SECRET: Joi.string().min(32).required(),
        TOKEN_ENCRYPTION_KEY: Joi.string().min(32).required(),
        CORS_ORIGIN: Joi.string().required(),
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redisClient: Redis) => ({
        throttlers: [
          {
            ttl: 60000,
            limit: 10,
          },
        ],
        storage: new RedisThrottlerStorage(redisClient),
      }),
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('DATABASE_URL'),
      }),
    }),

    HealthModule,
    RedisModule,
    UsersModule,
    PasswordModule,
    SessionsModule,
    AuthModule,
    MembershipsModule,
    WorkspacesModule,
    InvitationsModule,
    SocialConnectionsModule,
    ScheduleModule.forRoot(),
    PostsModule,
    MediaModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
