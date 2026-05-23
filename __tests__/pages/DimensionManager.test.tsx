import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DimensionDetailPage } from "../../src/pages/DimensionDetailPage";
import { DimensionManager } from "../../src/pages/DimensionManager";
import { AlertProvider } from "../../src/providers/AlertProvider";
import { SuperpositionUIProvider } from "../../src/providers/SuperpositionUIProvider";

const testConfig = {
  apiBaseUrl: "https://test.com",
  orgId: "org",
  workspace: "ws",
  capabilities: {
    dimensions: { create: true, delete: true },
  },
};

const mockDimensions = {
  total_pages: 1,
  total_items: 2,
  data: [
    {
      dimension: "region",
      position: 0,
      created_at: "",
      created_by: "",
      schema: { type: "string" },
      value_validation_function_name: null,
      last_modified_at: "",
      last_modified_by: "",
      mandatory: true,
      dependency_graph: {},
      description: "Regular dimension",
      change_reason: "",
      value_compute_function_name: null,
      dimension_type: { REGULAR: {} },
    },
    {
      dimension: "cohort",
      position: 1,
      created_at: "",
      created_by: "",
      schema: { type: "string" },
      value_validation_function_name: null,
      last_modified_at: "",
      last_modified_by: "",
      mandatory: false,
      dependency_graph: {},
      description: "Local cohort dimension",
      change_reason: "",
      value_compute_function_name: null,
      dimension_type: { LOCAL_COHORT: "user_segment" },
    },
  ],
};

describe("DimensionManager", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "500" }),
      json: () => Promise.resolve(mockDimensions),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders dimensions without the Type column", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <DimensionManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("region")).toBeDefined();
      expect(screen.getByText("cohort")).toBeDefined();
    });

    expect(screen.getByText("Dimensions")).toBeDefined();
    expect(
      screen.getByText("Manage all available dimensions and their metadata."),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /export/i })).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Select number of rows per page" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDefined();

    expect(screen.queryByRole("columnheader", { name: "Type" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Mandatory" })).toBeNull();
    expect(screen.queryByText("REGULAR")).toBeNull();
    expect(screen.queryByText("LOCAL_COHORT:user_segment")).toBeNull();
    expect(document.body.textContent).not.toContain("[object Object]");
  });

  it("shows create controls when embeddable feature controls enable editing", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          ui: {
            featureControls: {
              dimensions: { editable: true },
            },
          },
        }}
      >
        <AlertProvider>
          <DimensionManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create dimension" })).toBeDefined();
    });
  });

  it("opens the dimension detail page when a row is clicked", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/dimension/region")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "600" }),
          json: () =>
            Promise.resolve({
              ...mockDimensions.data[0],
              description: "Region detail view",
              change_reason: "row click",
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "500" }),
        json: () => Promise.resolve(mockDimensions),
      });
    });

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <DimensionManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("region"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "region" })).toBeDefined();
      expect(screen.getByText("Region detail view")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to dimensions" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Dimensions" })).toBeDefined();
      expect(screen.getByText("cohort")).toBeDefined();
    });
  });

  it("keeps dimension rows non-navigable when detail pages are disabled", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          ui: {
            featureControls: {
              dimensions: { detailPage: false },
            },
          },
        }}
      >
        <AlertProvider>
          <DimensionManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("region"));

    expect(screen.getByRole("heading", { name: "Dimensions" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Back to dimensions" })).toBeNull();
    expect(
      mockFetch.mock.calls.some(([url]) => String(url).includes("/dimension/region")),
    ).toBe(false);
  });

  it("renders a single dimension page with admin detail fields", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/dimension/region")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "600" }),
          json: () =>
            Promise.resolve({
              ...mockDimensions.data[0],
              schema: { type: "string", enum: ["us", "eu"] },
              value_validation_function_name: "validate_region",
              value_compute_function_name: "compute_region",
              dependency_graph: {
                region: ["country"],
                country: [],
              },
              created_by: "admin",
              last_modified_by: "operator",
              description: "Region dimension",
              change_reason: "dimension detail test",
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "500" }),
        json: () => Promise.resolve(mockDimensions),
      });
    });

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <DimensionDetailPage dimension="region" />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "region" })).toBeDefined();
      expect(screen.getByText("Dimension Type")).toBeDefined();
      expect(screen.getAllByText("REGULAR").length).toBeGreaterThan(0);
      expect(screen.getByText("Schema")).toBeDefined();
      expect(screen.getByText("validate_region")).toBeDefined();
      expect(screen.getByText("compute_region")).toBeDefined();
      expect(screen.getByText("country")).toBeDefined();
      expect(screen.getByText("Region dimension")).toBeDefined();
      expect(screen.getByText("dimension detail test")).toBeDefined();
    });
  });
});
