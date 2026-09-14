import { Role } from '../common/enums/role.enum';
import { MembershipsService } from './memberships.service';

describe('MembershipsService', () => {
  it('does not allow ownership transfer through role updates', async () => {
    const service = new MembershipsService({} as any, {} as any);

    await expect(
      service.updateMemberRole(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        Role.OWNER,
        '507f1f77bcf86cd799439013',
      ),
    ).rejects.toThrow('Ownership transfer is not supported in the MVP');
  });
});
