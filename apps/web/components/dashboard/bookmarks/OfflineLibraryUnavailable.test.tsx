// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OfflineLibraryUnavailable from "./OfflineLibraryUnavailable";

describe("OfflineLibraryUnavailable", () => {
  it("explains that no offline library exists on the first offline launch", () => {
    render(<OfflineLibraryUnavailable />);

    expect(
      screen.getByText(/offline library has not been downloaded/i),
    ).toBeTruthy();
  });
});
