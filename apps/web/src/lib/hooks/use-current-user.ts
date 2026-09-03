import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../api/auth";
import { ApiError } from "../api/client";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const { user } = await getCurrentUser();
        return user;
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 401) {
          return null; // not authenticated, not an error state
        }
        throw err;
      }
    },
  });
}
