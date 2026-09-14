import {
  Global,
  Injectable,
  Logger,
  Module,
  Inject,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const logger = new Logger('RedisModule');
export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
class RedisLifecycleService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redisClient.quit();
    } catch (err) {
      logger.error(
        `Failed to close Redis connection: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.redisClient.disconnect();
    }
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        const client = new Redis(redisUrl);

        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err) =>
          logger.error(`Redis connection error: ${err.message}`),
        );

        return client;
      },
    },
    RedisLifecycleService,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
