import { Injectable, BadRequestException } from '@nestjs/common';
import { SocialProvider } from '../enums/provider.enum';
import { ProviderAdapter } from './provider.interface';
import { InstagramProvider } from './instagram.provider';
import { FacebookProvider } from './facebook.provider';
import { LinkedInProvider } from './linkedin.provider';
import { XProvider } from './x.provider';

@Injectable()
export class ProviderRegistry {
  private readonly providers: Map<SocialProvider, ProviderAdapter>;

  constructor(
    instagram: InstagramProvider,
    facebook: FacebookProvider,
    linkedin: LinkedInProvider,
    x: XProvider,
  ) {
    const entries: [SocialProvider, ProviderAdapter][] = [
      [instagram.provider, instagram],
      [facebook.provider, facebook],
      [linkedin.provider, linkedin],
      [x.provider, x],
    ];
    this.providers = new Map(entries);
  }

  get(provider: SocialProvider): ProviderAdapter {
    const adapter = this.providers.get(provider);
    if (!adapter) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_PROVIDER',
        message: `Provider ${provider} is not supported`,
      });
    }
    return adapter;
  }
}
