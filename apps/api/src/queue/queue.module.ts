import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Post, PostSchema } from '../posts/schemas/post.schema';
import {
  PostTarget,
  PostTargetSchema,
} from '../posts/schemas/post-target.schema';
import {
  PublishingAttempt,
  PublishingAttemptSchema,
} from '../posts/schemas/publishing-attempt.schema';

import { QueueService } from './queue.service';
import { PublishWorker } from './publish.worker';
import { ReconciliationService } from './reconciliation.service';
import { MockPlatformModule } from '../mock-platform/mock-platform.module';
import { PostStatusAggregator } from '../posts/post-status-aggregator';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostTarget.name, schema: PostTargetSchema },
      {
        name: PublishingAttempt.name,
        schema: PublishingAttemptSchema,
      },
    ]),
    MockPlatformModule,
  ],
  providers: [
    QueueService,
    PublishWorker,
    ReconciliationService,
    PostStatusAggregator,
  ],
  exports: [QueueService, PostStatusAggregator, MongooseModule],
})
export class QueueModule {}
