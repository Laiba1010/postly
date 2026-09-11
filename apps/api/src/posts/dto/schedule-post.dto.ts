import { IsString, Matches } from 'class-validator';

export class SchedulePostDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, {
    message: 'time must be in HH:mm (24-hour) format',
  })
  time: string;

  @IsString()
  timezone: string;
}
