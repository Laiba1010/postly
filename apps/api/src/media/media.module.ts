import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Media, MediaSchema } from './schemas/media.schema';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { MediaCleanupService } from './media-cleanup.service';
import { STORAGE_PROVIDER } from './storage/storage-provider.interface';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
    AuthModule,
    forwardRef(() => WorkspacesModule),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaCleanupService,
    { provide: STORAGE_PROVIDER, useClass: LocalStorageProvider },
  ],
  exports: [MongooseModule, MediaService],
})
export class MediaModule {}
