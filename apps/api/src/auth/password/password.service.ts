import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

@Injectable()
export class PasswordService {
  private readonly options = {
    memoryCost: 19456, // ~19 MB, OWASP-recommended minimum for argon2id
    timeCost: 2,
    parallelism: 1,
  };

  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, this.options);
  }

  async verify(
    hashedPassword: string,
    plainPassword: string,
  ): Promise<boolean> {
    try {
      return await verify(hashedPassword, plainPassword);
    } catch {
      return false;
    }
  }
}
