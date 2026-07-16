// @vitest-environment jsdom

import React from "react";

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import VisualViewportSync from "./VisualViewportSync";

const initialInnerHeight = window.innerHeight;

class MockVisualViewport extends EventTarget {
  height = 844;
  offsetTop = 0;
}

afterEach(() => {
  document.documentElement.style.removeProperty("--vvh");
  document.documentElement.style.removeProperty("--vvo");
  document.documentElement.style.removeProperty("--vvb");
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: initialInnerHeight,
  });
});

describe("VisualViewportSync", () => {
  it("tracks the keyboard-covered layout viewport space for bottom sheets", () => {
    const viewport = new MockVisualViewport();
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });

    const view = render(<VisualViewportSync />);
    viewport.height = 544;
    viewport.dispatchEvent(new Event("resize"));

    expect(document.documentElement.style.getPropertyValue("--vvh")).toBe(
      "544px",
    );
    expect(document.documentElement.style.getPropertyValue("--vvo")).toBe(
      "0px",
    );
    expect(document.documentElement.style.getPropertyValue("--vvb")).toBe(
      "300px",
    );

    view.unmount();
    expect(document.documentElement.style.getPropertyValue("--vvb")).toBe("");
  });
});
