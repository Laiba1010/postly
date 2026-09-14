import { IsEmail, IsEnum, IsNotIn } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsEnum(Role)
  @IsNotIn([Role.OWNER], { message: 'Owner invitations are not supported' })
  role: Role;
}
