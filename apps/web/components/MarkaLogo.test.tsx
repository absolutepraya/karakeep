// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MarkaLogo from "./MarkaLogo";

describe("MarkaLogo", () => {
  it("uses the navy wordmark in light theme and the white one in dark theme", () => {
    render(<MarkaLogo height={38} />);

    const visibleLogo = screen.getByAltText("Marka");
    expect(visibleLogo.getAttribute("src")).toBe(
      "/brand/marka/marka-wordmark-navy.png",
    );
    expect(visibleLogo.getAttribute("height")).toBe("38");
    expect(visibleLogo.classList.contains("dark:hidden")).toBe(true);

    const darkLogo = document.querySelector(
      'img[src="/brand/marka/marka-wordmark-white.png"]',
    );
    expect(darkLogo).not.toBeNull();
    if (!darkLogo) {
      throw new Error("Expected the dark Marka wordmark");
    }

    expect(darkLogo.getAttribute("alt")).toBe("");
    expect(darkLogo.getAttribute("aria-hidden")).toBe("true");
    expect(darkLogo.getAttribute("height")).toBe("38");
    expect(darkLogo.classList.contains("hidden")).toBe(true);
    expect(darkLogo.classList.contains("dark:block")).toBe(true);
  });
});
