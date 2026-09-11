"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function getSupportedTimezones(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return FALLBACK_TIMEZONES;
    }
  }

  return FALLBACK_TIMEZONES;
}

interface TimezoneSelectProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}

export function TimezoneSelect({
  value,
  onChange,
  id,
  disabled,
}: TimezoneSelectProps) {
  const timezones = getSupportedTimezones();

  return (
    <Select
      value={value}
      onValueChange={(val) => {
        if (val !== null) {
          onChange(val);
        }
      }}
    >
      <SelectTrigger id={id} disabled={disabled}>
        <SelectValue placeholder="Select a timezone" />
      </SelectTrigger>

      <SelectContent className="max-h-72">
        {timezones.map((tz) => (
          <SelectItem key={tz} value={tz}>
            {tz.replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
