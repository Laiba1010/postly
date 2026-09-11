import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PostDestinationDto } from './post-destination.dto';

// 63206 = the largest single-platform limit (Facebook) in PLATFORM_RULES.
// This is a hard input ceiling, not a platform-specific check — that
// happens separately per selected destination via validateAgainstPlatformRules.
const ABSOLUTE_MAX_CONTENT_LENGTH = 63206;

export class SaveDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(ABSOLUTE_MAX_CONTENT_LENGTH)
  content?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostDestinationDto)
  destinations?: PostDestinationDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];
}
