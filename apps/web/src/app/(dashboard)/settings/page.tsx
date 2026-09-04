"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";

import { updateWorkspace } from "@/lib/api/workspaces";
import { useWorkspaceContext } from "@/lib/hooks/use-workspace-context";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100),
});

type FormValues = z.infer<typeof schema>;

export default function SettingsPage() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data: workspace, isLoading } = useWorkspaceContext(activeWorkspaceId);
  const queryClient = useQueryClient();

  const isOwner = workspace?.role === "OWNER";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (workspace) {
      form.reset({ name: workspace.name });
    }
  }, [workspace, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateWorkspace(activeWorkspaceId!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspace", activeWorkspaceId],
      });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  function onSubmit(values: FormValues) {
    mutation.mutate(values);
  }

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">Workspace settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            {isOwner
              ? "Update your workspace name."
              : "Only the workspace owner can edit these settings."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent>
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="workspace-name">
                      Workspace name
                    </FieldLabel>
                    <Input
                      {...field}
                      id="workspace-name"
                      disabled={!isOwner}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Field>
                <FieldLabel>Workspace URL slug</FieldLabel>
                <Input value={workspace?.slug ?? ""} disabled readOnly />
                <FieldDescription>
                  The slug is generated automatically and can&apos;t be changed.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          {isOwner && (
            <CardFooter>
              <Button
                type="submit"
                disabled={mutation.isPending || !form.formState.isDirty}
              >
                {mutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </CardFooter>
          )}
        </form>
      </Card>
    </div>
  );
}
