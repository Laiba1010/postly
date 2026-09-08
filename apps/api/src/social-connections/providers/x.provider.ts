import { Injectable } from '@nestjs/common';
import { SocialProvider } from '../enums/provider.enum';
import { ProviderAdapter, MockAccount } from './provider.interface';

@Injectable()
export class XProvider implements ProviderAdapter {
  readonly provider = SocialProvider.X;
  readonly displayName = 'X';

  getMockAccounts(): MockAccount[] {
    return [{ accountId: 'mock-x-001', accountName: '@postly_demo' }];
  }
}
