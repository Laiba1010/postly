import { Readable } from 'stream';

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export interface StorageProvider {
  save(params: {
    workspaceId: string;
    filename: string;
    buffer: Buffer;
  }): Promise<{ storageKey: string }>;

  saveFromFile(params: {
    workspaceId: string;
    filename: string;
    filePath: string;
  }): Promise<{ storageKey: string }>;

  read(storageKey: string): Promise<Buffer>;
  createReadStream(storageKey: string): Readable;
  delete(storageKey: string): Promise<void>;
}
