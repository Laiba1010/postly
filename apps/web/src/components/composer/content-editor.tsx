"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_RULES } from "@/lib/platform-rules";
import type { ComposerFormValues } from "@/lib/validations/composer";

interface ContentEditorProps {
  form: UseFormReturn<ComposerFormValues>;
}

export function ContentEditor({ form }: ContentEditorProps) {
  const content = form.watch("content");
  const destinations = form.watch("destinations");

  const uniqueProviders = [...new Set(destinations.map((d) => d.provider))];

  return (
    <Controller
      name="content"
      control={form.control}
      render={({ field }) => (
        <div className="space-y-2">
          <label htmlFor="post-content" className="text-sm font-medium">
            Content
          </label>
          <Textarea
            {...field}
            id="post-content"
            placeholder="Write your post..."
            rows={8}
            className="resize-none"
          />

          {uniqueProviders.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {content.length} characters
            </p>
          ) : (
            <ul className="space-y-1">
              {uniqueProviders.map((provider) => {
                const rule = PLATFORM_RULES[provider];
                const overLimit = content.length > rule.maxCharacters;
                return (
                  <li
                    key={provider}
                    className={`text-xs ${overLimit ? "font-medium text-destructive" : "text-muted-foreground"}`}
                  >
                    {provider}: {content.length} / {rule.maxCharacters}
                    {overLimit && " — exceeds limit"}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    />
  );
}
