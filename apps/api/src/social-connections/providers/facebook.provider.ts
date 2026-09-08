import { Injectable } from '@nestjs/common';
import { SocialProvider } from '../enums/provider.enum';
import { ProviderAdapter, MockAccount } from './provider.interface';

@Injectable()
export class FacebookProvider implements ProviderAdapter {
  readonly provider = SocialProvider.FACEBOOK;
  readonly displayName = 'Facebook';

  getMockAccounts(): MockAccount[] {
    return [
      { accountId: 'mock-facebook-001', accountName: 'Postly Demo Page' },
      { accountId: 'mock-facebook-002', accountName: 'Marketing Team Page' },
    ];
  }
}
