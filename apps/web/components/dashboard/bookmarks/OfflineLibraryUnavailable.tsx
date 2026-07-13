import React from "react";

type OfflineLibraryUnavailableProps = {
  error?: boolean;
};

export default function OfflineLibraryUnavailable({
  error = false,
}: OfflineLibraryUnavailableProps) {
  return (
    <section
      className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"
      role="status"
    >
      {error
        ? "Your offline library could not be read. Try reloading the page."
        : "Your offline library has not been downloaded yet. Connect to the internet once to download your bookmarks."}
    </section>
  );
}
