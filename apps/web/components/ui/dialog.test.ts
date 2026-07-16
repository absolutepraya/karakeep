// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { revealFocusedTextEntry } from "./dialog";

function setDimensions(
  element: HTMLElement,
  {
    clientHeight,
    scrollHeight,
    scrollTop = 0,
  }: {
    clientHeight: number;
    scrollHeight: number;
    scrollTop?: number;
  },
) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
    scrollTop: { configurable: true, value: scrollTop, writable: true },
  });
}

function setRect(element: Element, top: number, height: number) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, top, 320, height),
  );
}

afterEach(() => {
  document.body.replaceChildren();
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: undefined,
  });
});

describe("revealFocusedTextEntry", () => {
  it("scrolls a modal just enough to keep a focused field above the keyboard", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { height: 500, offsetTop: 0 },
    });

    const dialog = document.createElement("div");
    const input = document.createElement("input");
    dialog.style.overflowY = "auto";
    dialog.append(input);
    document.body.append(dialog);
    setDimensions(dialog, { clientHeight: 400, scrollHeight: 1000 });
    setRect(dialog, 0, 400);
    setRect(input, 520, 32);

    revealFocusedTextEntry(dialog, input);

    expect(dialog.scrollTop).toBe(64);
  });

  it("reveals a field above overlapping sticky dialog chrome", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { height: 600, offsetTop: 0 },
    });

    const dialog = document.createElement("div");
    const input = document.createElement("textarea");
    const footer = document.createElement("footer");
    dialog.style.overflowY = "auto";
    footer.style.position = "sticky";
    dialog.append(input, footer);
    document.body.append(dialog);
    setDimensions(dialog, { clientHeight: 600, scrollHeight: 1200 });
    setRect(dialog, 0, 600);
    setRect(input, 440, 32);
    setRect(footer, 430, 64);

    revealFocusedTextEntry(dialog, input);

    expect(dialog.scrollTop).toBe(54);
  });

  it("uses the closest scrollable modal container before its ancestor", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { height: 600, offsetTop: 0 },
    });

    const dialog = document.createElement("div");
    const nestedScroller = document.createElement("div");
    const input = document.createElement("input");
    dialog.style.overflowY = "auto";
    nestedScroller.style.overflowY = "auto";
    nestedScroller.append(input);
    dialog.append(nestedScroller);
    document.body.append(dialog);
    setDimensions(dialog, { clientHeight: 500, scrollHeight: 1000 });
    setDimensions(nestedScroller, { clientHeight: 400, scrollHeight: 900 });
    setRect(dialog, 0, 500);
    setRect(input, 620, 32);

    revealFocusedTextEntry(dialog, input);

    expect(nestedScroller.scrollTop).toBe(64);
    expect(dialog.scrollTop).toBe(0);
  });
});
