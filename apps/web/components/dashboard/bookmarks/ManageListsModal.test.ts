import { describe, expect, it } from "vitest";

import { truncateListPath } from "./listPath";

describe("truncateListPath", () => {
  it("replaces earlier folders with an ellipsis while preserving recent icons", () => {
    expect(
      truncateListPath([
        { icon: "📁", name: "First" },
        { icon: "🗂️", name: "Second" },
        { icon: "📚", name: "Third" },
        { icon: "⭐", name: "Current" },
      ]),
    ).toBe("… / 📚 Third / ⭐ Current");
  });

  it("keeps short paths complete", () => {
    expect(
      truncateListPath([
        { icon: "📁", name: "Parent" },
        { icon: "⭐", name: "Current" },
      ]),
    ).toBe("📁 Parent / ⭐ Current");
  });
});
