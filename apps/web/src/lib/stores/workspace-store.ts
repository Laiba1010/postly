import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceState {
  activeWorkspaceId: string | null;
  hasHydrated: boolean;
  setActiveWorkspaceId: (id: string | null) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      hasHydrated: false,
      setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "postly-active-workspace",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
