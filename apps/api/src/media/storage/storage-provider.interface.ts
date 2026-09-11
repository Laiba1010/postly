export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export interface StorageProvider {
  save(params: {
    workspaceId: string;
    filename: string;
    buffer: Buffer;
  }): Promise<{ storageKey: string }>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}
