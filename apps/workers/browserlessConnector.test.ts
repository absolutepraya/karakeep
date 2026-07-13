import { describe, expect, it } from "vitest";

import {
  buildBrowserlessWebSocketUrl,
  redactBrowserConnectionUrl,
} from "./browserlessConnector";

describe("Browserless connector", () => {
  it("builds a token-authenticated WebSocket URL", () => {
    expect(
      buildBrowserlessWebSocketUrl(
        "ws://shared-browserless:3000",
        "test-token",
      ),
    ).toBe("ws://shared-browserless:3000/?token=test-token");
  });

  it("redacts Browserless tokens from connection URLs", () => {
    expect(
      redactBrowserConnectionUrl(
        "ws://shared-browserless:3000/?token=test-token",
      ),
    ).toBe("ws://shared-browserless:3000/?token=redacted");
  });

  it("requires a token for Browserless connections", () => {
    expect(() =>
      buildBrowserlessWebSocketUrl("ws://shared-browserless:3000", undefined),
    ).toThrow("BROWSERLESS_TOKEN is required when BROWSERLESS_URL is set");
  });
});
