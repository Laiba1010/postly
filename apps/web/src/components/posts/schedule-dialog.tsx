"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  scheduleSchema,
  type ScheduleFormValues,
} from "@/lib/validations/schedule";
import {
  useSchedulePost,
  useReschedulePost,
} from "@/lib/hooks/use-schedule-post";
import { ApiError } from "@/lib/api/client";
import type { Post } from "@/lib/api/posts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { TimezoneSelect } from "./timezone-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScheduleDialogProps {
  workspaceId: string;
  post: Post;
  mode: "schedule" | "reschedule";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Convert an absolute UTC timestamp into the wall-clock
 * date/time represented in the post's saved timezone.
 *
 * Example:
 * UTC: 2027-01-13T16:49:00.000Z
 * timezone: Europe/Belgrade
 *
 * Result:
 * date: 2027-01-13
 * time: 17:49
 */
function splitIsoIntoDateTime(
  iso: string,
  timezone: string,
): {
  date: string;
  time: string;
} {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

    const parts = formatter.formatToParts(new Date(iso));

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );

    if (
      !values.year ||
      !values.month ||
      !values.day ||
      !values.hour ||
      !values.minute
    ) {
      throw new Error("Unable to parse scheduled timestamp");
    }

    return {
      date: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}`,
    };
  } catch {
    // If the stored timezone is somehow invalid,
    // fall back to the browser timezone rather than crashing the dialog.
    const fallbackTimezone = detectBrowserTimezone();

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: fallbackTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

    const parts = formatter.formatToParts(new Date(iso));

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );

    return {
      date: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}`,
    };
  }
}

export function ScheduleDialog({
  workspaceId,
  post,
  mode,
  open,
  onOpenChange,
}: ScheduleDialogProps) {
  const scheduleMutation = useSchedulePost(workspaceId);
  const rescheduleMutation = useReschedulePost(workspaceId);

  const mutation = mode === "schedule" ? scheduleMutation : rescheduleMutation;

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      date: "",
      time: "",
      timezone: detectBrowserTimezone(),
    },
  });

  useEffect(() => {
    if (!open) return;

    if (mode === "reschedule" && post.scheduledAt) {
      const timezone = post.timezone ?? detectBrowserTimezone();

      const { date, time } = splitIsoIntoDateTime(post.scheduledAt, timezone);

      form.reset({
        date,
        time,
        timezone,
      });
    } else {
      form.reset({
        date: "",
        time: "",
        timezone: detectBrowserTimezone(),
      });
    }

    mutation.reset();
  }, [open, mode, post.scheduledAt, post.timezone, form, mutation]);

  const hasDestinations = post.destinations.length > 0;
  const cannotSchedule = mode === "schedule" && !hasDestinations;

  function onSubmit(values: ScheduleFormValues) {
    if (cannotSchedule) {
      return;
    }

    mutation.mutate(
      {
        postId: post.id,
        input: values,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  }

  const apiErrorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.code === "CANNOT_SCHEDULE_EMPTY_POST"
        ? "Select at least one platform before scheduling."
        : mutation.error.code === "SCHEDULE_TIME_TOO_SOON"
          ? "Please choose a future time."
          : mutation.error.code === "INVALID_TIMEZONE"
            ? "That timezone is not recognized."
            : mutation.error.code === "INVALID_SCHEDULE_DATE"
              ? "Please choose a valid calendar date."
              : mutation.error.code === "INVALID_SCHEDULE_TIME"
                ? "Please choose a valid time."
                : mutation.error.code === "INVALID_STATE_TRANSITION"
                  ? "This post changed while you were editing it. Please close this dialog and refresh."
                  : mutation.error.code === "PLATFORM_VALIDATION_FAILED"
                    ? "Your content does not meet the requirements for one or more selected platforms."
                    : "Unable to schedule this post."
      : mutation.isError
        ? "Something went wrong. Please try again."
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "schedule" ? "Schedule post" : "Reschedule post"}
          </DialogTitle>

          <DialogDescription>
            {mode === "schedule"
              ? "Choose when and in which timezone this post should be published."
              : "Update the date, time, or timezone for this scheduled post."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            {cannotSchedule && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                Select at least one platform before scheduling.
              </div>
            )}

            <Controller
              name="date"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="schedule-date">Date</FieldLabel>

                  <Input
                    {...field}
                    id="schedule-date"
                    type="date"
                    aria-invalid={fieldState.invalid}
                    disabled={mutation.isPending}
                  />

                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="time"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="schedule-time">Time</FieldLabel>

                  <Input
                    {...field}
                    id="schedule-time"
                    type="time"
                    aria-invalid={fieldState.invalid}
                    disabled={mutation.isPending}
                  />

                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="timezone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="schedule-timezone">Timezone</FieldLabel>

                  <TimezoneSelect
                    id="schedule-timezone"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={mutation.isPending}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {apiErrorMessage && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {apiErrorMessage}
              </div>
            )}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={mutation.isPending || cannotSchedule}
            >
              {mutation.isPending
                ? mode === "schedule"
                  ? "Scheduling..."
                  : "Rescheduling..."
                : mode === "schedule"
                  ? "Schedule post"
                  : "Reschedule post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
