import { useMutation } from '@tanstack/react-query';
import { uploadMedia } from '../api/media';

export function useMediaUpload(workspaceId: string | null) {
  return useMutation({
    mutationFn: (file: File) => uploadMedia(workspaceId!, file),
  });
}