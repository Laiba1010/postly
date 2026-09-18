import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PostStatus } from '../enums/post-status.enum';
import { SocialProvider } from '../../social-connections/enums/provider.enum';

export enum PostListSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  SCHEDULED_AT = 'scheduledAt',
}

export enum PostListSortDir {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListPostsQueryDto {
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsEnum(SocialProvider)
  platform?: SocialProvider;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @IsOptional()
  @IsEnum(PostListSortBy)
  sortBy: PostListSortBy = PostListSortBy.UPDATED_AT;

  @IsOptional()
  @IsEnum(PostListSortDir)
  sortDir: PostListSortDir = PostListSortDir.DESC;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
