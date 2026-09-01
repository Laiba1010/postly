import { Test } from '@nestjs/testing';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get(PasswordService);
  });

  it('hashes and verifies a correct password', async () => {
    const hash = await service.hash('MyPassword123');
    const result = await service.verify(hash, 'MyPassword123');
    expect(result).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('MyPassword123');
    const result = await service.verify(hash, 'WrongPassword');
    expect(result).toBe(false);
  });
});
