import { apiClient } from "./client";

export interface User {
  id: string;
  name: string;
  email: string;
}

export function signup(input: {
  name: string;
  email: string;
  password: string;
}) {
  return apiClient.post<{ user: User }>("/api/auth/signup", input);
}

export function login(input: { email: string; password: string }) {
  return apiClient.post<{ user: User }>("/api/auth/login", input);
}

export function logout() {
  return apiClient.post<{ success: boolean }>("/api/auth/logout");
}

export function getCurrentUser() {
  return apiClient.get<{ user: User }>("/api/auth/me");
}
