import { SocialProvider } from '../enums/provider.enum';

export interface MockAccount {
  accountId: string;
  accountName: string;
}

export interface ProviderAdapter {
  readonly provider: SocialProvider;
  readonly displayName: string;
  getMockAccounts(): MockAccount[];
}
