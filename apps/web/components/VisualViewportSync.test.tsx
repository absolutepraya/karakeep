// @vitest-environment jsdom

import React from "react";

import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import VisualViewportSync from "./VisualViewportSync";

const initialInnerHeight = window.innerHeight;

class MockVisualViewport extends EventTarget {
  height = 844;
  offsetTop = 0;
}

afterEach(() => {
  vi.useRealTimers();
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
  it("rechecks the first text-field focus after the keyboard viewport settles", () => {
    vi.useFakeTimers();
    const viewport = new MockVisualViewport();
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });

    render(<VisualViewportSync />);
    const portaledSearch = document.createElement("input");
    portaledSearch.type = "search";
    document.body.append(portaledSearch);

    act(() => portaledSearch.focus());

    // On the first iOS keyboard opening, the viewport can settle after the
    // initial focus and resize work has run, without another resize event.
    viewport.height = 500;
    act(() => vi.advanceTimersByTime(350));

    expect(document.documentElement.style.getPropertyValue("--vvh")).toBe(
      "500px",
    );
    expect(document.documentElement.style.getPropertyValue("--vvb")).toBe(
      "344px",
    );
  });

  it("tracks the visible viewport dimensions for centered dialogs", () => {
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
    expect(document.documentElement.style.getPropertyValue("--vvh")).toBe("");
  });
});
