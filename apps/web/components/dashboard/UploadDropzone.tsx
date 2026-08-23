"use client";

import React, { useCallback, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { BOOKMARK_DRAG_MIME } from "@/lib/bookmark-drag";
import useUpload from "@/lib/hooks/upload-file";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { TRPCClientError } from "@trpc/client";
import DropZone from "react-dropzone";

import { useCreateBookmarkWithPostHook } from "@karakeep/shared-react/hooks/bookmarks";
import { useDeleteUnattachedAsset } from "@karakeep/shared-react/hooks/assets";
import {
  getTextDocumentTitle,
  getBookmarkAssetTypeForMimeType,
  getDropzoneAccept,
  isTextDocumentFile,
  readTextDocument,
} from "@karakeep/shared/content-support";
import { BookmarkTypes } from "@karakeep/shared/types/bookmarks";

import LoadingSpinner from "../ui/spinner";
import BookmarkAlreadyExistsToast from "../utils/BookmarkAlreadyExistsToast";

export function useUploadAsset() {
  const { mutateAsync: deleteUnattachedAsset } = useDeleteUnattachedAsset();
  const { mutateAsync: createBookmark } = useCreateBookmarkWithPostHook({
    onSuccess: (resp) => {
      if (resp.alreadyExists) {
        toast({
          description: <BookmarkAlreadyExistsToast bookmarkId={resp.id} />,
          variant: "default",
        });
      } else {
        toast({ description: "Bookmark uploaded" });
      }
    },
    onError: () => {
      toast({ description: "Something went wrong", variant: "destructive" });
    },
  });

  const { mutateAsync: runUploadAsset } = useUpload({
    onSuccess: async (resp) => {
      const assetType = getBookmarkAssetTypeForMimeType(resp.contentType);
      if (!assetType) {
        throw new Error(
          `${resp.fileName}: this file can only be added as an attachment`,
        );
      }
      await createBookmark({
        ...resp,
        type: BookmarkTypes.ASSET,
        assetType,
        source: "web",
      });
    },
    onSuccessError: async (resp) => {
      await deleteUnattachedAsset({ assetId: resp.assetId });
    },
    onError: (err, req) => {
      toast({
        description: `${req.name}: ${err.error}`,
        variant: "destructive",
      });
    },
  });

  return useCallback(
    async (file: File) => {
      // Handle Markdown and plain-text files as text bookmarks.
      if (isTextDocumentFile(file.name, file.type)) {
        try {
          const content = await readTextDocument(file);
          await createBookmark({
            type: BookmarkTypes.TEXT,
            text: content,
            title: getTextDocumentTitle(file.name),
            source: "web",
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to read text document";
          toast({
            description: `${file.name}: ${message}`,
            variant: "destructive",
          });
        }
      } else {
        return runUploadAsset(file);
      }
    },
    [createBookmark, deleteUnattachedAsset, runUploadAsset],
  );
}

function useUploadAssets({
  onFileUpload,
  onFileError,
  onAllUploaded,
}: {
  onFileUpload: () => void;
  onFileError: (name: string, e: Error) => void;
  onAllUploaded: () => void;
}) {
  const runUpload = useUploadAsset();

  return async (files: File[]) => {
    if (files.length == 0) {
      return;
    }
    for (const file of files) {
      try {
        await runUpload(file);
        onFileUpload();
      } catch (e) {
        if (e instanceof TRPCClientError || e instanceof Error) {
          onFileError(file.name, e);
        }
      }
    }
    onAllUploaded();
  };
}

export default function UploadDropzone({
  children,
}: {
  children: React.ReactNode;
}) {
  const [numUploading, setNumUploading] = useState(0);
  const [numUploaded, setNumUploaded] = useState(0);
  const { t } = useTranslation();
  const uploadAssets = useUploadAssets({
    onFileUpload: () => {
      setNumUploaded((c) => c + 1);
    },
    onFileError: () => {
      setNumUploaded((c) => c + 1);
    },
    onAllUploaded: () => {
      setNumUploading(0);
      setNumUploaded(0);
      return;
    },
  });

  const [isDragging, setDragging] = useState(false);
  const onDrop = (acceptedFiles: File[]) => {
    uploadAssets(acceptedFiles);
    setNumUploading(acceptedFiles.length);
    setDragging(false);
  };

  return (
    <DropZone
      noClick
      accept={getDropzoneAccept("topLevel")}
      onDrop={onDrop}
      onDropRejected={(fileRejections) => {
        fileRejections.forEach(({ file }) => {
          toast({
            description: `${file.name}: ${t("common.only_images_pdf_markdown_top_level")}`,
            variant: "destructive",
          });
        });
      }}
      onDragEnter={(e) => {
        // Don't show overlay for internal bookmark card drags
        if (!e.dataTransfer.types.includes(BOOKMARK_DRAG_MIME)) {
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
    >
      {({ getRootProps, getInputProps }) => (
        <div {...getRootProps()}>
          <input {...getInputProps()} hidden />
          <div
            className={cn(
              "fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-gray-200 opacity-90",
              isDragging || numUploading > 0 ? undefined : "hidden",
            )}
          >
            {numUploading > 0 ? (
              <div className="flex items-center justify-center gap-2">
                <p className="text-2xl font-bold text-gray-700">
                  Uploading {numUploaded} / {numUploading}
                </p>
                <LoadingSpinner />
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-700">
                Drop an image, PDF, Markdown, or plain-text file
              </p>
            )}
          </div>
          {children}
        </div>
      )}
    </DropZone>
  );
}
