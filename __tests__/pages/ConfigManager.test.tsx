import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigDetailPage } from "../../src/pages/ConfigDetailPage";
import { ConfigManager } from "../../src/pages/ConfigManager";
import { AlertProvider } from "../../src/providers/AlertProvider";
import { SuperpositionUIProvider } from "../../src/providers/SuperpositionUIProvider";

const testConfig = {
  apiBaseUrl: "https://test.com",
  orgId: "org",
  workspace: "ws",
  capabilities: {
    config: { create: true, delete: true },
  },
};

const mockConfigs = {
  total_pages: 1,
  total_items: 2,
  data: [
    {
      key: "app.title",
      value: "My App",
      created_at: "2024-01-01T00:00:00Z",
      created_by: "admin",
      schema: { type: "string" },
      value_validation_function_name: null,
      last_modified_at: "2024-01-01T00:00:00Z",
      last_modified_by: "admin",
      description: "App title",
      change_reason: "init",
      value_compute_function_name: null,
    },
    {
      key: "app.version",
      value: 2,
      created_at: "2024-01-01T00:00:00Z",
      created_by: "admin",
      schema: { type: "integer" },
      value_validation_function_name: null,
      last_modified_at: "2024-01-01T00:00:00Z",
      last_modified_by: "admin",
      description: "App version",
      change_reason: "init",
      value_compute_function_name: null,
    },
  ],
};

function buildMockConfig(key: string, value: unknown = key) {
  return {
    key,
    value,
    created_at: "2024-01-01T00:00:00Z",
    created_by: "admin",
    schema: { type: "string" },
    value_validation_function_name: null,
    last_modified_at: "2024-01-01T00:00:00Z",
    last_modified_by: "admin",
    description: `${key} description`,
    change_reason: "init",
    value_compute_function_name: null,
  };
}

describe("ConfigManager", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "500" }),
      json: () => Promise.resolve(mockConfigs),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders config list", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <ConfigManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("app.title")).toBeDefined();
      expect(screen.getByText("app.version")).toBeDefined();
    });

    expect(screen.queryByRole("columnheader", { name: "Mandatory" })).toBeNull();
    expect(screen.getByPlaceholderText("Search by key")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Select number of rows per page" }),
    ).toBeDefined();
  });

  it("shows create button", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <ConfigManager editable />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create config" })).toBeDefined();
    });
  });

  it("honors action-level capabilities", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          capabilities: {
            config: { create: false, delete: false },
          },
        }}
      >
        <AlertProvider>
          <ConfigManager editable />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("app.title")).toBeDefined();
    });

    expect(screen.queryByText("Create config")).toBeNull();
    expect(screen.queryAllByText("Delete")).toHaveLength(0);
  });

  it("shows create controls when embeddable feature controls enable editing", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          ui: {
            featureControls: {
              config: { editable: true },
            },
          },
        }}
      >
        <AlertProvider>
          <ConfigManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Create config")).toBeDefined();
    });
  });

  it("opens the default config detail page when a row is clicked", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/default-config/app.title")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "500" }),
          json: () =>
            Promise.resolve({
              ...mockConfigs.data[0],
              description: "App title detail view",
            }),
        });
      }

      if (url.includes("/config/resolve/explain/app.title")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "500" }),
          json: () =>
            Promise.resolve({
              key: "app.title",
              timeline: [],
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "500" }),
        json: () => Promise.resolve(mockConfigs),
      });
    });

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <ConfigManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("app.title"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "app.title" })).toBeDefined();
      expect(screen.getByText("App title detail view")).toBeDefined();
      expect(screen.getByText("Explanation")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to configs" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Configs" })).toBeDefined();
      expect(screen.getByText("app.version")).toBeDefined();
    });
  });

  it("keeps config rows non-navigable when detail pages are disabled", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          ui: {
            featureControls: {
              config: { detailPage: false },
            },
          },
        }}
      >
        <AlertProvider>
          <ConfigManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("app.title"));

    expect(screen.getByRole("heading", { name: "Configs" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Back to configs" })).toBeNull();
    expect(
      mockFetch.mock.calls.some(([url]) =>
        String(url).includes("/default-config/app.title"),
      ),
    ).toBe(false);
  });

  it("refetches when host connection config changes", async () => {
    const { rerender } = render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <ConfigManager editable />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.com/config/resolve/detailed",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ context: {} }),
        }),
      );
    });

    rerender(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          apiBaseUrl: "https://changed.test",
        }}
      >
        <AlertProvider>
          <ConfigManager editable />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "https://changed.test/config/resolve/detailed",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ context: {} }),
        }),
      );
    });
  });

  it("paginates all fetched default configs locally", async () => {
    const originalInnerWidth = window.innerWidth;
    const configs = Array.from({ length: 12 }, (_, index) =>
      buildMockConfig(`app.config.${String(index + 1).padStart(2, "0")}`, index + 1),
    );

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 500,
    });
    window.dispatchEvent(new Event("resize"));
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "500" }),
      json: () =>
        Promise.resolve({
          total_pages: 1,
          total_items: configs.length,
          data: configs,
        }),
    });

    try {
      render(
        <SuperpositionUIProvider config={testConfig}>
          <AlertProvider>
            <ConfigManager showResolvedValues={false} />
          </AlertProvider>
        </SuperpositionUIProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("app.config.01")).toBeDefined();
        expect(screen.getByText("app.config.10")).toBeDefined();
      });

      expect(screen.queryByText("app.config.11")).toBeNull();
      expect(screen.getByText("Showing 1 to 10 of 12 records")).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "Next page" }));

      await waitFor(() => {
        expect(screen.getByText("app.config.11")).toBeDefined();
        expect(screen.getByText("app.config.12")).toBeDefined();
      });

      expect(screen.queryByText("app.config.01")).toBeNull();
      expect(
        mockFetch.mock.calls.filter(([url]) => String(url).includes("/default-config")),
      ).toHaveLength(1);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: originalInnerWidth,
      });
      window.dispatchEvent(new Event("resize"));
    }
  });

  it("shows heading", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <ConfigManager editable />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "Configs" })).toBeDefined();
    });
  });

  it("shows inline validation for invalid JSON before create", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <ConfigManager editable />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("Create config"));
    const dialog = within(
      await screen.findByRole("dialog", { name: "Create Default Config" }),
    );
    fireEvent.change(dialog.getByLabelText("Key*"), {
      target: { value: "key1" },
    });
    fireEvent.change(dialog.getByLabelText("Value*"), {
      target: { value: "value1" },
    });
    fireEvent.change(dialog.getByLabelText("Change Reason*"), {
      target: { value: "test reason" },
    });

    expect(screen.getByText(/Plain text is stored as a string/i)).toBeDefined();
    expect(dialog.getByText("Create")).not.toBeDisabled();
  });

  it("creates a config when plain text value is entered", async () => {
    mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "250" }),
          json: () =>
            Promise.resolve({
              key: "key1",
              value: "value1",
              schema: { type: "string" },
              created_at: "2024-01-01T00:00:00Z",
              created_by: "admin",
              value_validation_function_name: null,
              last_modified_at: "2024-01-01T00:00:00Z",
              last_modified_by: "admin",
              description: "desc",
              change_reason: "test reason",
              value_compute_function_name: null,
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "500" }),
        json: () => Promise.resolve(mockConfigs),
      });
    });

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <ConfigManager editable />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("Create config"));
    const dialog = within(
      await screen.findByRole("dialog", { name: "Create Default Config" }),
    );
    fireEvent.change(dialog.getByLabelText("Key*"), {
      target: { value: "key1" },
    });
    fireEvent.change(dialog.getByLabelText("Value*"), {
      target: { value: "value1" },
    });
    fireEvent.change(dialog.getByLabelText("Description"), {
      target: { value: "desc" },
    });
    fireEvent.change(dialog.getByLabelText("Change Reason*"), {
      target: { value: "test reason" },
    });

    fireEvent.click(dialog.getByText("Create"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.com/default-config",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            key: "key1",
            value: "value1",
            schema: { type: "string" },
            description: "desc",
            change_reason: "test reason",
          }),
        }),
      );
    });
  });

  it("applies configured prefix filters and displays detailed resolved scoped values", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/config/resolve/detailed")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "100" }),
          json: () =>
            Promise.resolve({
              "app.title": {
                value: "Resolved US App",
                schema: { type: "string" },
                description: "App title",
              },
              "app.version": {
                value: 2,
                schema: { type: "integer" },
                description: "App version",
              },
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "500" }),
        json: () => Promise.resolve(mockConfigs),
      });
    });

    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: { context: { region: "us-east-1" } },
          filters: { defaultConfigPrefix: "app." },
        }}
      >
        <AlertProvider>
          <ConfigManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Resolved US App/)).toBeDefined();
    });

    expect(screen.getByText("app.title")).toBeDefined();
    expect(screen.getByText("app.version")).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.com/config/resolve/detailed?prefix=app.",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ context: { region: "us-east-1" } }),
      }),
    );
    expect(
      mockFetch.mock.calls.some(([url]) =>
        String(url).includes("/default-config?all=true"),
      ),
    ).toBe(false);
  });

  it("blocks creating configs outside the configured prefix", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          filters: { defaultConfigPrefix: "app." },
        }}
      >
        <AlertProvider>
          <ConfigManager editable />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("Create config"));
    fireEvent.change(screen.getByLabelText("Key*"), {
      target: { value: "other.title" },
    });
    fireEvent.change(screen.getByLabelText("Change Reason*"), {
      target: { value: "test reason" },
    });

    expect(screen.getByText("Key must start with app.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("renders a single default config page and calls the explain API", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/default-config/app.title")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "500" }),
          json: () => Promise.resolve(mockConfigs.data[0]),
        });
      }

      if (url.includes("/config/resolve/explain/app.title")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "500" }),
          json: () =>
            Promise.resolve({
              key: "app.title",
              timeline: [
                {
                  context_id: "ctx_us",
                  condition: { region: "us-east-1" },
                  override_id: "override_1",
                  value_before: "My App",
                  value_after: "US App",
                },
              ],
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "500" }),
        json: () => Promise.resolve(mockConfigs),
      });
    });

    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: { context: { region: "us-east-1" } },
        }}
      >
        <AlertProvider>
          <ConfigDetailPage configKey="app.title" mergeStrategy="MERGE" />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "app.title" })).toBeDefined();
      expect(screen.getByText("Explanation")).toBeDefined();
      expect(screen.getByText("override_1")).toBeDefined();
      expect(screen.getAllByText("US App").length).toBeGreaterThan(0);
      expect(screen.getByText("Summary")).toBeDefined();
      expect(screen.getByRole("status")).toHaveTextContent("Resolved");
      expect(
        screen.getByRole("table", { name: "Config resolution explanation" }),
      ).toBeDefined();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.com/config/resolve/explain/app.title",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ context: { region: "us-east-1" } }),
        headers: expect.objectContaining({
          "x-merge-strategy": "MERGE",
        }),
      }),
    );
  });
});
