import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH_BYTES = 32;

@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const secret = configService.get<string>('TOKEN_ENCRYPTION_KEY')!;
    const key = Buffer.from(secret, 'hex');

    if (key.length !== KEY_LENGTH_BYTES) {
      throw new Error(
        `TOKEN_ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH_BYTES} bytes ` +
          `(a 64-character hex string). Generate one with: ` +
          `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
      );
    }

    this.key = key;
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(encoded: string): string {
    const [ivHex, authTagHex, encryptedHex] = encoded.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
