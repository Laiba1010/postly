import { apiClient } from './client';

export type MediaType = 'IMAGE' | 'VIDEO';

export interface Media {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  mediaType: MediaType;
  createdAt: string;
}

export async function uploadMedia(workspaceId: string, file: File): Promise<{ media: Media }> {
  const formData = new FormData();
  formData.append('file', file);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/media`, {
    method: 'POST',
    credentials: 'include',
    body: formData, // deliberately no Content-Type header — the browser
                     // sets the correct multipart boundary automatically
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const { ApiError } = await import('./client');
    throw new ApiError(res.status, data?.code ?? 'UNKNOWN_ERROR', data?.message ?? 'Upload failed');
  }

  return data;
}

export function deleteMedia(workspaceId: string, mediaId: string) {
  return apiClient.delete<{ success: boolean }>(`/api/workspaces/${workspaceId}/media/${mediaId}`);
}

export function getMediaFileUrl(workspaceId: string, mediaId: string): string {
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  return `${API_URL}/api/workspaces/${workspaceId}/media/${mediaId}/file`;
}