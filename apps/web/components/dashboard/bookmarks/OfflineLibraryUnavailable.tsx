import React from "react";

export default function OfflineLibraryUnavailable() {
  return (
    <section
      className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"
      role="status"
    >
      Your offline library has not been downloaded yet. Connect to the internet
      once to download your bookmarks.
    </section>
  );
}
