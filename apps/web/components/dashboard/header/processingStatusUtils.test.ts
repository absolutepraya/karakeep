import { describe, expect, test } from "vitest";

import {
  getProcessingBreakdown,
  getProcessingRefreshInterval,
} from "./processingStatusUtils";

describe("processing status semantics", () => {
  test("counts crawling bookmarks as foreground and AI work as background", () => {
    const processing = {
      total: 4,
      tasks: [
        { kind: "crawling" as const, count: 1 },
        { kind: "tagging" as const, count: 2 },
        { kind: "summarizing" as const, count: 1 },
      ],
    };

    expect(getProcessingBreakdown(processing)).toEqual({
      preparingCount: 1,
      importingCount: 0,
      backgroundTotal: 3,
      backgroundTasks: [
        { kind: "tagging", count: 2 },
        { kind: "summarizing", count: 1 },
      ],
    });
    expect(getProcessingRefreshInterval(processing)).toBe(1000);
  });

  test("background enrichment alone does not keep the foreground activity hot", () => {
    const processing = {
      total: 3,
      tasks: [
        { kind: "tagging" as const, count: 2 },
        { kind: "summarizing" as const, count: 1 },
      ],
    };

    expect(getProcessingBreakdown(processing).preparingCount).toBe(0);
    expect(getProcessingRefreshInterval(processing)).toBe(15_000);
  });

  test("imports stay visible without being counted as crawling bookmarks", () => {
    const processing = {
      total: 2,
      tasks: [
        { kind: "importing" as const, count: 1 },
        { kind: "tagging" as const, count: 1 },
      ],
    };

    expect(getProcessingBreakdown(processing)).toEqual({
      preparingCount: 0,
      importingCount: 1,
      backgroundTotal: 1,
      backgroundTasks: [{ kind: "tagging", count: 1 }],
    });
    expect(getProcessingRefreshInterval(processing)).toBe(15_000);
  });
});
