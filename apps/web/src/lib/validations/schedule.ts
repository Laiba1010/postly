import { z } from "zod";

const validDate = /^\d{4}-\d{2}-\d{2}$/;
const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function isValidCalendarDate(value: string): boolean {
  if (!validDate.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const scheduleSchema = z.object({
  date: z
    .string()
    .regex(validDate, "Please select a valid date")
    .refine(isValidCalendarDate, "Please select a valid date"),

  time: z.string().regex(validTime, "Please select a valid time"),

  timezone: z.string().min(1, "Please select a timezone"),
});

export type ScheduleFormValues = z.infer<typeof scheduleSchema>;
