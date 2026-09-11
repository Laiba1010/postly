import { IsEnum, IsString } from 'class-validator';
import { SocialProvider } from '../../social-connections/enums/provider.enum';

export class PostDestinationDto {
  @IsEnum(SocialProvider)
  provider: SocialProvider;

  @IsString()
  socialConnectionId: string;
}
