import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { createWorkspace } from "@/lib/api/workspaces";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

const schema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100),
});

export type CreateWorkspaceFormValues = z.infer<typeof schema>;

export function useCreateWorkspaceForm(onSuccess: () => void) {
  const queryClient = useQueryClient();
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);

  const form = useForm<CreateWorkspaceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  const mutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: ({ workspace }) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setActiveWorkspaceId(workspace.id);
      form.reset();
      onSuccess();
    },
  });

  return { form, mutation };
}
