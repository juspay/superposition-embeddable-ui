import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchField } from "../../src/components/SearchField";
import { SuperpositionUIProvider } from "../../src/providers/SuperpositionUIProvider";

const testConfig = {
  apiBaseUrl: "https://test.com",
  orgId: "org",
  workspace: "ws",
};

describe("SearchField", () => {
  it("renders the Blend search input with a leading search icon", () => {
    const { container } = render(
      <SuperpositionUIProvider config={testConfig}>
        <SearchField
          value=""
          onChange={vi.fn()}
          placeholder="Search by key"
          ariaLabel="Search configs"
        />
      </SuperpositionUIProvider>,
    );

    expect(screen.getByRole("searchbox", { name: "Search configs" })).toBeDefined();
    expect(container.querySelector(".sp-search-field svg")).toBeDefined();
  });
});
