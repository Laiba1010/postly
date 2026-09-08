import { IsBoolean, IsOptional, IsString, ValidateIf } from 'class-validator';

export class OAuthCallbackDto {
  @IsString()
  state: string;

  @IsOptional()
  @IsBoolean()
  cancelled?: boolean;

  // Required unless this is a cancellation — a request with
  // { state } alone and no cancelled flag now fails validation
  // at the API boundary instead of surfacing as a confusing
  // downstream "invalid account" error.
  @ValidateIf((o) => o.cancelled !== true)
  @IsString()
  accountId?: string;
}
