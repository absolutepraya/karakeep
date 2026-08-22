import { useMutation } from "@tanstack/react-query";

import {
  ZUploadError,
  zUploadErrorSchema,
  ZUploadResponse,
  zUploadResponseSchema,
} from "@karakeep/shared/types/uploads";

export default function useUpload({
  onSuccess,
  onSuccessError,
  onError,
}: {
  onError?: (e: ZUploadError, req: File) => void;
  onSuccess?: (resp: ZUploadResponse, req: File) => Promise<void>;
  onSuccessError?: (
    resp: ZUploadResponse,
    req: File,
    error: unknown,
  ) => Promise<void>;
}) {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/assets", {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      return zUploadResponseSchema.parse(await resp.json());
    },
    onSuccess: async (resp, req) => {
      try {
        await onSuccess?.(resp, req);
      } catch (error) {
        if (onSuccessError) {
          await onSuccessError(resp, req, error).catch(() => undefined);
        }
        throw error;
      }
    },
    onError: (error, req) => {
      let err: ZUploadError;
      try {
        err = zUploadErrorSchema.parse(JSON.parse(error.message));
      } catch {
        err = {
          error: error instanceof Error ? error.message : "Upload failed",
        };
      }
      if (onError) {
        onError(err, req);
      }
    },
  });
}
