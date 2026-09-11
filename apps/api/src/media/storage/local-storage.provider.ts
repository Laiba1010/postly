import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly basePath: string;

  constructor(configService: ConfigService) {
    this.basePath =
      configService.get<string>('MEDIA_STORAGE_PATH') ?? './storage/media';
  }

  private resolvePath(storageKey: string): string {
    return join(this.basePath, storageKey);
  }

  async save(params: {
    workspaceId: string;
    filename: string;
    buffer: Buffer;
  }): Promise<{ storageKey: string }> {
    const storageKey = `${params.workspaceId}/${params.filename}`;
    const fullPath = this.resolvePath(storageKey);

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, params.buffer);

    return { storageKey };
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.resolvePath(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await unlink(this.resolvePath(storageKey)).catch(() => {
      // Already gone — deletion is idempotent, not an error condition.
    });
  }
}
