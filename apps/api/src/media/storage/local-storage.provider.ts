import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { copyFile, mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, isAbsolute, resolve, relative, sep } from 'path';
import { Readable } from 'stream';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly basePath: string;

  constructor(configService: ConfigService) {
    this.basePath = resolve(
      configService.get<string>('MEDIA_STORAGE_PATH') ?? './storage/media',
    );
  }

  private resolvePath(storageKey: string): string {
    const normalized = storageKey.replaceAll('\\', '/');
    const fullPath = resolve(this.basePath, normalized);
    const relativePath = relative(this.basePath, fullPath);

    if (
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new Error('INVALID_STORAGE_KEY');
    }

    return fullPath;
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

  async saveFromFile(params: {
    workspaceId: string;
    filename: string;
    filePath: string;
  }): Promise<{ storageKey: string }> {
    const storageKey = `${params.workspaceId}/${params.filename}`;
    const fullPath = this.resolvePath(storageKey);

    if (!isAbsolute(params.filePath)) {
      throw new Error('INVALID_SOURCE_FILE_PATH');
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await copyFile(params.filePath, fullPath);

    return { storageKey };
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.resolvePath(storageKey));
  }

  createReadStream(storageKey: string): Readable {
    return createReadStream(this.resolvePath(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await unlink(this.resolvePath(storageKey)).catch(() => {
      // Already gone — deletion is idempotent.
    });
  }
}
