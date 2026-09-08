import { Injectable } from '@nestjs/common';
import { SocialProvider } from '../enums/provider.enum';
import { ProviderAdapter, MockAccount } from './provider.interface';

@Injectable()
export class LinkedInProvider implements ProviderAdapter {
  readonly provider = SocialProvider.LINKEDIN;
  readonly displayName = 'LinkedIn';

  getMockAccounts(): MockAccount[] {
    return [{ accountId: 'mock-linkedin-001', accountName: 'Postly Inc.' }];
  }
}
