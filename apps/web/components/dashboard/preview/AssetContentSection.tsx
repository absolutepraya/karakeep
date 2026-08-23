import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n/client";
import { Download } from "lucide-react";

import { BookmarkTypes, ZBookmark } from "@karakeep/shared/types/bookmarks";
import { getContentFormatForBookmarkAssetType } from "@karakeep/shared/content-support";
import { getAssetUrl } from "@karakeep/shared/utils/assetUtils";

// 20 MB
const BIG_FILE_SIZE = 20 * 1024 * 1024;

function PDFContentSection({ bookmark }: { bookmark: ZBookmark }) {
  if (bookmark.content.type != BookmarkTypes.ASSET) {
    throw new Error("Invalid content type");
  }
  const { t } = useTranslation();

  const initialSection = useMemo(() => {
    if (bookmark.content.type != BookmarkTypes.ASSET) {
      throw new Error("Invalid content type");
    }

    const screenshot = bookmark.assets.find(
      (item) => item.assetType === "assetScreenshot",
    );
    const bigSize =
      bookmark.content.size && bookmark.content.size > BIG_FILE_SIZE;
    if (bigSize && screenshot) {
      return "screenshot";
    }
    return "pdf";
  }, [bookmark]);
  const [section, setSection] = useState(initialSection);

  const screenshot = bookmark.assets.find(
    (r) => r.assetType === "assetScreenshot",
  )?.id;

  const content =
    section === "screenshot" && screenshot ? (
      <div className="relative h-full min-w-full">
        <Image
          alt="screenshot"
          src={getAssetUrl(screenshot)}
          fill={true}
          sizes="100vw"
          unoptimized
          className="object-contain"
        />
      </div>
    ) : (
      <embed
        title={bookmark.content.assetId}
        type="application/pdf"
        className="h-full w-full"
        src={getAssetUrl(bookmark.content.assetId)}
      />
    );

  return (
    <div className="flex h-full flex-col items-center gap-2">
      <div className="flex w-full items-center justify-center gap-4">
        <Select onValueChange={setSection} value={section}>
          <SelectTrigger className="w-fit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="screenshot" disabled={!screenshot}>
                {t("common.screenshot")}
              </SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {content}
    </div>
  );
}

function ImageContentSection({ bookmark }: { bookmark: ZBookmark }) {
  if (bookmark.content.type != BookmarkTypes.ASSET) {
    throw new Error("Invalid content type");
  }
  return (
    <div className="relative h-full min-w-full">
      <Link href={getAssetUrl(bookmark.content.assetId)} target="_blank">
        <Image
          alt="asset"
          fill={true}
          sizes="100vw"
          unoptimized
          className="object-contain"
          src={getAssetUrl(bookmark.content.assetId)}
        />
      </Link>
    </div>
  );
}

function VideoContentSection({ bookmark }: { bookmark: ZBookmark }) {
  if (bookmark.content.type != BookmarkTypes.ASSET) {
    throw new Error("Invalid content type");
  }

  const assetUrl = getAssetUrl(bookmark.content.assetId);
  const fileName = bookmark.content.fileName ?? "video";
  const isMatroska =
    bookmark.content.contentType === "video/x-matroska" ||
    bookmark.content.fileName?.toLowerCase().endsWith(".mkv") === true;
  const [playbackError, setPlaybackError] = useState(isMatroska);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
      {playbackError ? (
        <div
          role="alert"
          className="flex max-w-md flex-col items-center gap-3 text-center text-sm text-muted-foreground"
        >
          <p>
            This video format is not supported for in-browser playback. You can
            download the original file instead.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- captions are not yet part of the uploaded-video model */}
          <video
            className="max-h-full max-w-full"
            controls
            preload="metadata"
            playsInline
            aria-label={bookmark.title ?? fileName}
            onError={() => setPlaybackError(true)}
          >
            <source
              src={assetUrl}
              type={bookmark.content.contentType ?? undefined}
            />
            Your browser does not support this video format.
          </video>
        </div>
      )}
      <Link
        href={assetUrl}
        download={fileName}
        className="shadow-xs inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <Download className="size-4" aria-hidden="true" />
        Download {fileName}
      </Link>
    </div>
  );
}

export function AssetContentSection({ bookmark }: { bookmark: ZBookmark }) {
  if (bookmark.content.type != BookmarkTypes.ASSET) {
    throw new Error("Invalid content type");
  }
  switch (
    getContentFormatForBookmarkAssetType(bookmark.content.assetType)?.id
  ) {
    case "image":
      return <ImageContentSection bookmark={bookmark} />;
    case "pdf":
      return <PDFContentSection bookmark={bookmark} />;
    case "video":
      return <VideoContentSection bookmark={bookmark} />;
    default:
      return <div>Unsupported asset type</div>;
  }
}
