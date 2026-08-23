// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UploadDropzone from "./UploadDropzone";

const mocks = vi.hoisted(() => ({
  createBookmark: vi.fn(),
  deleteUnattachedAsset: vi.fn(),
  uploadAsset: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
vi.mock("@/lib/hooks/upload-file", () => ({
  default: () => ({ mutateAsync: mocks.uploadAsset }),
}));
vi.mock("@karakeep/shared-react/hooks/assets", () => ({
  useDeleteUnattachedAsset: () => ({
    mutateAsync: mocks.deleteUnattachedAsset,
  }),
}));
vi.mock("@karakeep/shared-react/hooks/bookmarks", () => ({
  useCreateBookmarkWithPostHook: () => ({
    mutateAsync: mocks.createBookmark,
  }),
}));

function dropFile(container: HTMLElement, file: File) {
  const target = container.querySelector("[data-drop-target]");
  if (!target) {
    throw new Error("Drop target not found");
  }

  fireEvent.drop(target, {
    dataTransfer: {
      files: [file],
      items: [
        {
          kind: "file",
          type: file.type,
          getAsFile: () => file,
        },
      ],
      types: ["Files"],
    },
  });
}

function makeFile(bytes: ArrayBuffer, name: string, type: string): File {
  const file = new File([bytes], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.slice(0),
  });
  return file;
}

describe("UploadDropzone", () => {
  beforeEach(() => {
    mocks.createBookmark.mockReset();
    mocks.createBookmark.mockResolvedValue({
      alreadyExists: false,
      id: "bookmark-1",
    });
    mocks.deleteUnattachedAsset.mockReset();
    mocks.uploadAsset.mockReset();
    mocks.toast.mockReset();
  });

  it("creates a text bookmark from a plain-text file with the source intact", async () => {
    const source = "# Plain text\n\nKeep this source exactly as written.";
    const { container } = render(
      <UploadDropzone>
        <div data-drop-target>Drop target</div>
      </UploadDropzone>,
    );

    dropFile(
      container,
      makeFile(
        new TextEncoder().encode(source).buffer as ArrayBuffer,
        "notes.txt",
        "text/plain",
      ),
    );

    await waitFor(() => {
      expect(mocks.createBookmark).toHaveBeenCalledWith({
        type: "text",
        text: source,
        title: "notes",
        source: "web",
      });
    });
  });

  it("reports invalid UTF-8 instead of creating a replacement-text bookmark", async () => {
    const { container } = render(
      <UploadDropzone>
        <div data-drop-target>Drop target</div>
      </UploadDropzone>,
    );

    dropFile(
      container,
      makeFile(
        new Uint8Array([0xc3, 0x28]).buffer as ArrayBuffer,
        "notes.txt",
        "text/plain",
      ),
    );

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        description: "notes.txt: Text document must be UTF-8",
        variant: "destructive",
      });
    });
    expect(mocks.createBookmark).not.toHaveBeenCalled();
  });

  it("exposes plain-text files in the top-level file picker", () => {
    const { container } = render(
      <UploadDropzone>
        <div data-drop-target>Drop target</div>
      </UploadDropzone>,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input?.getAttribute("accept")).toContain("text/plain");
    expect(input?.getAttribute("accept")).toContain(".txt");
  });
});
