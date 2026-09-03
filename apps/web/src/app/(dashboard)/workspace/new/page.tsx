import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";

export default function NewWorkspacePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-center">
          Create your workspace
        </h1>
        <CreateWorkspaceForm />
      </div>
    </div>
  );
}
