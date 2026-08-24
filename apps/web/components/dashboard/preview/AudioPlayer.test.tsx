// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AudioPlayer } from "./AudioPlayer";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { fileName?: string }) =>
      values?.fileName ? `${key}:${values.fileName}` : key,
  }),
}));

describe("AudioPlayer", () => {
  afterEach(cleanup);

  it("renders an accessible metadata-preloaded audio player and download action", () => {
    render(
      <AudioPlayer
        src="/api/assets/audio-1"
        fileName="song.mp3"
        contentType="audio/mpeg"
        title="Song"
      />,
    );

    const audio = screen.getByLabelText("Song");
    expect(audio.tagName).toBe("AUDIO");
    expect(audio.getAttribute("preload")).toBe("metadata");
    expect(audio.querySelector("source")?.getAttribute("src")).toBe(
      "/api/assets/audio-1",
    );
    expect(audio.querySelector("source")?.getAttribute("type")).toBe(
      "audio/mpeg",
    );
    expect(
      screen
        .getByLabelText("actions.download_file:song.mp3")
        .getAttribute("href"),
    ).toBe("/api/assets/audio-1");
  });

  it("shows a download fallback when the browser cannot play the audio", () => {
    render(
      <AudioPlayer
        src="/api/assets/audio-1"
        fileName="song.mp3"
        contentType="audio/mpeg"
      />,
    );

    fireEvent.error(screen.getByLabelText("song.mp3"));

    expect(screen.getByRole("alert").textContent).toContain(
      "common.audio_playback_unavailable",
    );
    expect(
      screen
        .getByRole("link", { name: "actions.download_file:song.mp3" })
        .getAttribute("download"),
    ).toBe("song.mp3");
  });

  it("resets the fallback when the audio source changes", () => {
    const { rerender } = render(
      <AudioPlayer
        src="/api/assets/audio-1"
        fileName="song.mp3"
        contentType="audio/mpeg"
      />,
    );

    fireEvent.error(screen.getByLabelText("song.mp3"));
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(
      <AudioPlayer
        src="/api/assets/audio-2"
        fileName="new-song.mp3"
        contentType="audio/mpeg"
      />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("new-song.mp3")).toBeTruthy();
    expect(
      screen
        .getByLabelText("new-song.mp3")
        .querySelector("source")
        ?.getAttribute("src"),
    ).toBe("/api/assets/audio-2");
  });
});
