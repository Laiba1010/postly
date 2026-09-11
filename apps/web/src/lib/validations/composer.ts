import { z } from "zod";

export const composerSchema = z.object({
  content: z.string(),
  destinations: z.array(
    z.object({
      provider: z.enum(["INSTAGRAM", "FACEBOOK", "LINKEDIN", "X"]),
      socialConnectionId: z.string(),
    }),
  ),
  mediaIds: z.array(z.string()),
});

export type ComposerFormValues = z.infer<typeof composerSchema>;
