import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { createWorkspace, type Workspace } from "@/lib/api/workspaces";
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
    defaultValues: {
      name: "",
    },
  });

  const mutation = useMutation({
    mutationFn: createWorkspace,

    onSuccess: ({ workspace }) => {
      // Immediately update the cached workspace list so the newly
      // created workspace is available before the refetch completes.
      queryClient.setQueryData<Workspace[]>(
        ["workspaces"],
        (currentWorkspaces) => {
          if (!currentWorkspaces) {
            return [workspace];
          }

          return [...currentWorkspaces, workspace];
        },
      );

      // Automatically select the newly created workspace.
      setActiveWorkspaceId(workspace.id);

      // Reset the form and close the dialog.
      form.reset();
      onSuccess();

      // Refetch in the background to confirm the cache matches the backend.
      queryClient.invalidateQueries({
        queryKey: ["workspaces"],
      });
    },
  });

  return {
    form,
    mutation,
  };
}
