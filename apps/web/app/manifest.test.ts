import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("manifest", () => {
  it("uses Marka names and generated Marka icon files", () => {
    const result = manifest();
    const iconPaths = [...new Set(result.icons?.map((icon) => icon.src))];

    expect(result.name).toBe("Marka");
    expect(result.short_name).toBe("Marka");
    expect(iconPaths).toHaveLength(5);
    expect(iconPaths).toEqual(
      expect.arrayContaining([
        "/brand/marka/marka-icon-16.png",
        "/brand/marka/marka-icon-48.png",
        "/brand/marka/marka-icon-128.png",
        "/brand/marka/marka-icon-192.png",
        "/brand/marka/marka-icon-512.png",
      ]),
    );
    expect(
      iconPaths.every((path) =>
        /^\/brand\/marka\/marka-icon-\d+\.png$/.test(path),
      ),
    ).toBe(true);
  });
});
