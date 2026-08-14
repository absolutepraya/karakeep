import { describe, expect, it } from "vitest";

import { MARKA } from "./brand";

describe("MARKA", () => {
  it("defines the Marka identity and generated asset paths", () => {
    expect(MARKA).toEqual({
      name: "Marka",
      description:
        "A self-hostable library for links, notes, images, and web pages.",
      wordmark: {
        navy: "/brand/marka/marka-wordmark-navy.png",
        white: "/brand/marka/marka-wordmark-white.png",
      },
      icon: {
        light: "/brand/marka/marka-favicon-light.png",
        dark: "/brand/marka/marka-favicon-dark.png",
        apple: "/brand/marka/marka-apple-touch-icon.png",
      },
    });
  });
});
