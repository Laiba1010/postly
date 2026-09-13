import { Module } from '@nestjs/common';

import { MockPlatformService } from './mock-platform.service';

// REDIS_CLIENT is provided by the @Global() RedisModule (imported once in
// AppModule), so it does not need to be imported here — same pattern
// already used by QueueService.
@Module({
  providers: [MockPlatformService],
  exports: [MockPlatformService],
})
export class MockPlatformModule {}
