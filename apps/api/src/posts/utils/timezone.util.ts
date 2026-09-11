import { BadRequestException } from '@nestjs/common';
import { fromZonedTime } from 'date-fns-tz';

export function isValidIanaTimezone(timezone: string): boolean {
  if (!timezone.trim()) {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
    });

    return true;
  } catch {
    return false;
  }
}

function isValidCalendarDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isValidTime(time: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function calculateScheduledUtc(
  date: string,
  time: string,
  timezone: string,
): Date {
  if (!isValidCalendarDate(date)) {
    throw new BadRequestException({
      code: 'INVALID_SCHEDULE_DATE',
      message: 'The provided date is not a valid calendar date',
    });
  }

  if (!isValidTime(time)) {
    throw new BadRequestException({
      code: 'INVALID_SCHEDULE_TIME',
      message: 'The provided time is not valid',
    });
  }

  if (!isValidIanaTimezone(timezone)) {
    throw new BadRequestException({
      code: 'INVALID_TIMEZONE',
      message: `"${timezone}" is not a recognized timezone`,
    });
  }

  const localDateTime = `${date}T${time}:00`;

  // Updated to use date-fns-tz v3 method: fromZonedTime
  const utcDate = fromZonedTime(localDateTime, timezone);

  if (Number.isNaN(utcDate.getTime())) {
    throw new BadRequestException({
      code: 'INVALID_SCHEDULE_DATE',
      message: 'The provided date and time could not be parsed',
    });
  }

  return utcDate;
}

export function assertScheduledInFuture(utcDate: Date): void {
  if (utcDate.getTime() <= Date.now()) {
    throw new BadRequestException({
      code: 'SCHEDULE_TIME_TOO_SOON',
      message: 'Scheduled time must be in the future',
    });
  }
}
