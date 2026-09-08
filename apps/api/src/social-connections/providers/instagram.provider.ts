import { Injectable } from '@nestjs/common';
import { SocialProvider } from '../enums/provider.enum';
import { ProviderAdapter, MockAccount } from './provider.interface';

@Injectable()
export class InstagramProvider implements ProviderAdapter {
  readonly provider = SocialProvider.INSTAGRAM;
  readonly displayName = 'Instagram';

  getMockAccounts(): MockAccount[] {
    return [
      { accountId: 'mock-instagram-001', accountName: '@postly_demo' },
      { accountId: 'mock-instagram-002', accountName: '@marketing_team' },
      { accountId: 'mock-instagram-003', accountName: '@brand_account' },
    ];
  }
}
