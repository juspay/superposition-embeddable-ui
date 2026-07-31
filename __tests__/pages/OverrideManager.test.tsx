import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverrideManager } from "../../src/pages/OverrideManager";
import { AlertProvider } from "../../src/providers/AlertProvider";
import { SuperpositionUIProvider } from "../../src/providers/SuperpositionUIProvider";

const testConfig = {
  apiBaseUrl: "https://test.com",
  orgId: "org",
  workspace: "ws",
  capabilities: {
    overrides: { create: true, update: true },
  },
};

const mockOverrides = {
  total_pages: 1,
  total_items: 4,
  data: [
    {
      id: "ctx-1",
      value: { region: "us-east-1", env: "prod" },
      override_id: "ovr-1",
      created_at: "2024-01-01T00:00:00Z",
      created_by: "admin",
      override: { "app.title": "US App", "feature.enabled": true },
      last_modified_at: "2024-01-01T00:00:00Z",
      last_modified_by: "admin",
      weight: "100",
      description: "US override",
      change_reason: "init",
    },
    {
      id: "ctx-2",
      value: { region: "eu-west-1" },
      override_id: "ovr-2",
      created_at: "2024-01-01T00:00:00Z",
      created_by: "admin",
      override: { "app.title": "EU App" },
      last_modified_at: "2024-01-01T00:00:00Z",
      last_modified_by: "admin",
      weight: "50",
      description: "EU override",
      change_reason: "init",
    },
    {
      id: "ctx-3",
      value: { region: "us-east-1" },
      override_id: "ovr-3",
      created_at: "2024-01-01T00:00:00Z",
      created_by: "admin",
      override: { "app.title": "Region App" },
      last_modified_at: "2024-01-01T00:00:00Z",
      last_modified_by: "admin",
      weight: "25",
      description: "Region override",
      change_reason: "init",
    },
    {
      id: "ctx-4",
      value: { env: "prod" },
      override_id: "ovr-4",
      created_at: "2024-01-01T00:00:00Z",
      created_by: "admin",
      override: { "app.title": "Env App" },
      last_modified_at: "2024-01-01T00:00:00Z",
      last_modified_by: "admin",
      weight: "20",
      description: "Env override",
      change_reason: "init",
    },
  ],
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
      description: "",
      change_reason: "",
      value_compute_function_name: null,
      dimension_type: "REGULAR",
    },
    {
      dimension: "env",
      position: 1,
      created_at: "",
      created_by: "",
      schema: { type: "string", enum: ["prod", "staging"] },
      value_validation_function_name: null,
      last_modified_at: "",
      last_modified_by: "",
      mandatory: false,
      dependency_graph: {},
      description: "",
      change_reason: "",
      value_compute_function_name: null,
      dimension_type: "REGULAR",
    },
    {
      dimension: "merchant_id",
      position: 2,
      created_at: "",
      created_by: "",
      schema: { type: "string" },
      value_validation_function_name: null,
      last_modified_at: "",
      last_modified_by: "",
      mandatory: false,
      dependency_graph: {},
      description: "",
      change_reason: "",
      value_compute_function_name: null,
      dimension_type: "REGULAR",
    },
    {
      dimension: "profile_id",
      position: 3,
      created_at: "",
      created_by: "",
      schema: { type: "string" },
      value_validation_function_name: null,
      last_modified_at: "",
      last_modified_by: "",
      mandatory: false,
      dependency_graph: {},
      description: "",
      change_reason: "",
      value_compute_function_name: null,
      dimension_type: "REGULAR",
    },
  ],
};

const mockDefaultConfigs = {
  total_pages: 1,
  total_items: 2,
  data: [
    {
      key: "app.title",
      value: "Default title",
      created_at: "",
      created_by: "",
      schema: { type: "string" },
      value_validation_function_name: null,
      last_modified_at: "",
      last_modified_by: "",
      description: "",
      change_reason: "",
      value_compute_function_name: null,
    },
    {
      key: "feature.enabled",
      value: false,
      created_at: "",
      created_by: "",
      schema: { type: "boolean" },
      value_validation_function_name: null,
      last_modified_at: "",
      last_modified_by: "",
      description: "",
      change_reason: "",
      value_compute_function_name: null,
    },
  ],
};

function buildResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-length": "500" }),
    json: () => Promise.resolve(body),
  };
}

async function chooseFromDropdown(label: string, value: string) {
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: label });
  await user.click(trigger);
  const item = await screen.findByRole("menuitem", { name: value });
  fireEvent.click(item);
}

async function chooseFromDropdownField(placeholder: string, value: string) {
  const user = userEvent.setup();
  const field = screen.getByPlaceholderText(placeholder);
  await user.click(field);
  const item = await screen.findByRole("menuitem", { name: value });
  fireEvent.click(item);
}

describe("OverrideManager", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve(
          buildResponse({
            id: "ctx-3",
            value: { region: "us-east-1", env: "prod" },
            override_id: "ovr-3",
            created_at: "2024-01-01T00:00:00Z",
            created_by: "admin",
            override: { "app.title": "Scoped App" },
            last_modified_at: "2024-01-01T00:00:00Z",
            last_modified_by: "admin",
            weight: "100",
            description: "Scoped override",
            change_reason: "test create",
          }),
        );
      }

      if (url.includes("/dimension")) {
        return Promise.resolve(buildResponse(mockDimensions));
      }

      if (url.includes("/default-config")) {
        return Promise.resolve(buildResponse(mockDefaultConfigs));
      }

      if (url.includes("/context?") && url.includes("dimension[region]=us-east-1")) {
        const data = url.includes("dimension[env]=prod")
          ? [mockOverrides.data[0], mockOverrides.data[2], mockOverrides.data[3]]
          : [mockOverrides.data[0], mockOverrides.data[2]];
        return Promise.resolve(
          buildResponse({
            ...mockOverrides,
            total_items: data.length,
            data,
          }),
        );
      }

      return Promise.resolve(buildResponse(mockOverrides));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders override list", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Overrides" })).toBeDefined();
      expect(
        screen.getByText(
          "Review scoped overrides, then expand a card to inspect its conditions and values.",
        ),
      ).toBeDefined();
    });
    expect(screen.queryByText("4 overrides")).toBeNull();
    expect(screen.getAllByText("Condition").length).toBeGreaterThan(0);
    expect(screen.getAllByText("region:us-east-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+1 more condition").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Dimension:/)).toBeNull();
    expect(screen.queryByText(/Value:/)).toBeNull();
    expect(screen.queryByText("US App")).toBeNull();
  });

  it("searches override cards across contexts, values, and metadata", async () => {
    const user = userEvent.setup();

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "Edit override ctx-1" }),
    ).toBeDefined();

    await user.type(screen.getByPlaceholderText("Search overrides"), "EU");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-2" })).toBeDefined();
      expect(screen.queryByRole("button", { name: "Edit override ctx-1" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Edit override ctx-3" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Edit override ctx-4" })).toBeNull();
    });

    expect(mockFetch.mock.calls.some(([url]) => String(url).includes("all=true"))).toBe(
      true,
    );
    expect(mockFetch.mock.calls.some(([url]) => String(url).includes("plaintext="))).toBe(
      false,
    );
  });

  it("paginates override cards when the API returns the full dataset", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager pageSize={2} />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Edit override ctx-2" })).toBeDefined();
    });

    expect(screen.getByText("Showing 1 to 2 of 4 records")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Edit override ctx-3" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit override ctx-4" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(screen.getByText("Showing 3 to 4 of 4 records")).toBeDefined();
      expect(screen.getByRole("button", { name: "Edit override ctx-3" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Edit override ctx-4" })).toBeDefined();
    });

    expect(screen.queryByRole("button", { name: "Edit override ctx-1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit override ctx-2" })).toBeNull();
  });

  it("shows pagination when the API returns paged overrides without a total item count", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/dimension")) {
        return Promise.resolve(buildResponse(mockDimensions));
      }

      if (url.includes("/default-config")) {
        return Promise.resolve(buildResponse(mockDefaultConfigs));
      }

      if (url.includes("/context?") && url.includes("page=2")) {
        return Promise.resolve(
          buildResponse({
            total_pages: 2,
            data: [mockOverrides.data[2], mockOverrides.data[3]],
          }),
        );
      }

      return Promise.resolve(
        buildResponse({
          total_pages: 2,
          data: [mockOverrides.data[0], mockOverrides.data[1]],
        }),
      );
    });

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager pageSize={2} />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Edit override ctx-2" })).toBeDefined();
    });

    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Edit override ctx-3" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-3" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Edit override ctx-4" })).toBeDefined();
    });

    expect(screen.queryByRole("button", { name: "Edit override ctx-1" })).toBeNull();
    expect(
      mockFetch.mock.calls.some(([url]) =>
        String(url).includes("/context?page=2&count=2"),
      ),
    ).toBe(true);
  });

  it("shows pagination when paged overrides omit total metadata", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/dimension")) {
        return Promise.resolve(buildResponse(mockDimensions));
      }

      if (url.includes("/default-config")) {
        return Promise.resolve(buildResponse(mockDefaultConfigs));
      }

      if (url.includes("/context?") && url.includes("page=2")) {
        return Promise.resolve(
          buildResponse({
            data: [mockOverrides.data[2]],
          }),
        );
      }

      return Promise.resolve(
        buildResponse({
          data: [mockOverrides.data[0], mockOverrides.data[1]],
        }),
      );
    });

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager pageSize={2} />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Edit override ctx-2" })).toBeDefined();
    });

    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeDefined();
    expect(screen.queryByText(/Showing 1 to 2/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-3" })).toBeDefined();
    });

    expect(screen.queryByRole("button", { name: "Edit override ctx-1" })).toBeNull();
    expect(
      mockFetch.mock.calls.some(([url]) =>
        String(url).includes("/context?page=2&count=2"),
      ),
    ).toBe(true);
  });

  it("hides pagination controls when a single override fits on the page", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/dimension")) {
        return Promise.resolve(buildResponse(mockDimensions));
      }

      if (url.includes("/default-config")) {
        return Promise.resolve(buildResponse(mockDefaultConfigs));
      }

      return Promise.resolve(
        buildResponse({
          ...mockOverrides,
          total_pages: 1,
          total_items: 1,
          data: [mockOverrides.data[0]],
        }),
      );
    });

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "Edit override ctx-1" }),
    ).toBeDefined();
    expect(screen.queryByText("1 override")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("shows the shared empty state when no overrides exist", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/dimension")) {
        return Promise.resolve(buildResponse(mockDimensions));
      }

      if (url.includes("/default-config")) {
        return Promise.resolve(buildResponse(mockDefaultConfigs));
      }

      return Promise.resolve(
        buildResponse({
          ...mockOverrides,
          total_items: 0,
          data: [],
        }),
      );
    });

    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: { context: { region: "us-east-1" } },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    expect(await screen.findByText("No overrides found")).toBeDefined();
    expect(
      screen.getByText("This scoped context does not have any overrides yet."),
    ).toBeDefined();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByPlaceholderText("Search overrides")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Create override" })).toBeDefined();
  });

  it("shows create override when free-form context editing is enabled", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/dimension")) {
        return Promise.resolve(buildResponse(mockDimensions));
      }

      if (url.includes("/default-config")) {
        return Promise.resolve(buildResponse(mockDefaultConfigs));
      }

      return Promise.resolve(
        buildResponse({
          ...mockOverrides,
          total_items: 0,
          data: [],
        }),
      );
    });

    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          capabilities: { overrides: { create: true, update: true } },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    expect(await screen.findByText("No overrides found")).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Create override" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Create override" }));

    expect(screen.getByRole("button", { name: "Add Context" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add Override" })).toBeDefined();
  });

  it("shows context controls when creating without a fixed scope", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("Create override"));

    expect(screen.getByRole("button", { name: "Add Context" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add Override" })).toBeDefined();
    expect(screen.getAllByText("Add Context").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Add Override").length).toBeGreaterThan(0);
    expect(screen.queryByText("Select a key")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(
      screen.getAllByText("Add at least one context condition.").length,
    ).toBeGreaterThan(0);
  });

  it("allows creating overrides with any context dimension", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          capabilities: { overrides: { create: true, update: true } },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("Create override"));

    await chooseFromDropdownField("Add Context", "region");
    fireEvent.change(screen.getByLabelText("region"), {
      target: { value: "us-east-1" },
    });
    await chooseFromDropdownField("Add Override", "app.title");
    fireEvent.change(screen.getByLabelText("app.title"), {
      target: { value: "Scoped App" },
    });
    fireEvent.change(screen.getByLabelText("Reason for Change*"), {
      target: { value: "test create" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    // The create request is sent — the backend is responsible for authorization
    await waitFor(() => {
      expect(
        mockFetch.mock.calls.some(
          ([url, init]) => url === "https://test.com/context" && init?.method === "PUT",
        ),
      ).toBe(true);
    });
  });

  it("keeps scoped dimensions available in create override", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: {
            context: { region: "us-east-1" },
          },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("Create override"));

    await chooseFromDropdown("Add Context", "region");
    fireEvent.change(screen.getByLabelText("region"), {
      target: { value: "us-east-1" },
    });
    await chooseFromDropdown("Add Override", "app.title");
    fireEvent.change(screen.getByLabelText("app.title"), {
      target: { value: "Scoped App" },
    });
    fireEvent.change(screen.getByLabelText("Reason for Change*"), {
      target: { value: "test create with scoped dimension" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.com/context",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            context: { region: "us-east-1" },
            override: { "app.title": "Scoped App" },
            description: undefined,
            change_reason: "test create with scoped dimension",
          }),
        }),
      );
    });
  });

  it("does not show the empty overrides state when loading overrides fails", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/dimension")) {
        return Promise.resolve(buildResponse(mockDimensions));
      }

      if (url.includes("/default-config")) {
        return Promise.resolve(buildResponse(mockDefaultConfigs));
      }

      return Promise.resolve({
        ok: false,
        status: 500,
        headers: new Headers({ "content-length": "11" }),
        text: () => Promise.resolve("server down"),
      });
    });

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    expect(await screen.findByText("Could not load overrides")).toBeDefined();
    expect(screen.queryByText("No overrides found")).toBeNull();
    expect(screen.queryByText("!")).toBeNull();
    expect(screen.queryByText(/context\?/)).toBeNull();
    expect(screen.getByPlaceholderText("Search overrides")).toBeDefined();
  });

  it("clears save errors when the override form closes", async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve({
          ok: false,
          status: 500,
          headers: new Headers({ "content-length": "11" }),
          text: () => Promise.resolve("server down"),
        });
      }

      if (url.includes("/dimension")) {
        return Promise.resolve(buildResponse(mockDimensions));
      }

      if (url.includes("/default-config")) {
        return Promise.resolve(buildResponse(mockDefaultConfigs));
      }

      return Promise.resolve(buildResponse(mockOverrides));
    });

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("Create override"));

    await chooseFromDropdown("Add Context", "region");
    fireEvent.change(screen.getByLabelText("region"), {
      target: { value: "us-east-1" },
    });
    await chooseFromDropdown("Add Override", "app.title");
    fireEvent.change(screen.getByLabelText("app.title"), {
      target: { value: "Scoped App" },
    });
    fireEvent.change(screen.getByLabelText("Reason for Change*"), {
      target: { value: "test create" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Could not save override")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByText("Create override"));

    expect(screen.queryByText("Could not save override")).toBeNull();
  });

  it("opens change information for an override card", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByLabelText("View change information for ctx-1"));

    expect(screen.getByRole("dialog", { name: "Change Information" })).toBeDefined();
    expect(screen.getByText("Description")).toBeDefined();
    expect(screen.getByText("US override")).toBeDefined();
    expect(screen.getByText("Reason for Change")).toBeDefined();
    expect(screen.getByText("init")).toBeDefined();
    expect(screen.getByText(/by admin/)).toBeDefined();
  });

  it("does not render delete actions in the override list", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "Edit override ctx-1" }),
    ).toBeDefined();
    expect(screen.queryAllByRole("button", { name: /Delete override/ }).length).toBe(0);
  });

  it("shows expanded override details while keeping edit available and delete hidden", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "Edit override ctx-1" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", { name: "Expand override details for ctx-1" }),
    );

    expect(
      screen.getByRole("button", { name: "Collapse override details for ctx-1" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    expect(screen.queryAllByRole("button", { name: /Delete override/ }).length).toBe(0);
    const details = screen.getByLabelText("Expanded override details for ctx-1");
    expect(within(details).getByText("Dimension")).toBeDefined();
    expect(within(details).getByText("region")).toBeDefined();
    expect(within(details).getByText("us-east-1")).toBeDefined();
    expect(within(details).getByText("Key")).toBeDefined();
    expect(within(details).getAllByText("Value").length).toBeGreaterThan(0);
    expect(within(details).queryByText(/Dimension:/)).toBeNull();
    expect(within(details).queryByText(/Value:/)).toBeNull();
  });

  it("filters overrides by scoped context", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: { context: { region: "us-east-1" } },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    });

    expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Edit override ctx-2" })).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.com/context?page=1&count=10&dimension[region]=us-east-1&dimension_match_strategy=non_conflicting",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("shows locked host scope in the header metadata", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: {
            context: {
              cid: "swiggy",
              region: "india",
              env: "production",
              country: "IN",
              merchant_id: "m_123",
            },
          },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    });

    const lockedScope = screen.getByRole("group", { name: "Locked scope" });
    const headerDescription = screen.getByText(
      "Review scoped overrides, then expand a card to inspect its conditions and values.",
    );
    const header = headerDescription.closest("header");

    expect(header).toBeTruthy();
    expect(header?.contains(lockedScope)).toBe(false);
    expect(within(lockedScope).getByText("Scope")).toBeDefined();
    expect(within(lockedScope).getByTitle("cid = swiggy")).toBeDefined();
    expect(within(lockedScope).getByTitle("region = india")).toBeDefined();
    expect(within(lockedScope).getByTitle("env = production")).toBeDefined();
    expect(within(lockedScope).getByText("+2 more")).toBeDefined();
  });

  it("does not show locked scope when the host scope is unlocked", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: { context: { region: "us-east-1" }, locked: false },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    });

    expect(screen.queryByRole("group", { name: "Locked scope" })).toBeNull();
  });

  it("uses non-conflicting context filtering when strict is enabled", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          strict: true,
          scope: { context: { region: "us-east-1" } },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    });

    expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Edit override ctx-2" })).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.com/context?page=1&count=10&dimension[region]=us-east-1&dimension_match_strategy=non_conflicting",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("shows edit controls for overrides within the active scope", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: { context: { region: "us-east-1" } },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    });

    // Both overrides have region: us-east-1 matching the scope
    expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit override ctx-3" })).toBeDefined();
  });

  it("shows edit controls for all overrides when update capability is enabled", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: { context: { region: "us-east-1", env: "prod" } },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    });
    expect(screen.getByRole("button", { name: "Edit override ctx-3" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit override ctx-4" })).toBeDefined();
  });

  it("does not let scoped context hide edit controls", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: {
            context: { region: "us-east-1", env: "prod" },
          },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-4" })).toBeDefined();
    });

    expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit override ctx-3" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit override ctx-4" })).toBeDefined();
  });

  it("opens edit even when the row falls outside the active scoped context", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: {
            context: { region: "us-east-1", env: "prod" },
          },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-4" })).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit override ctx-3" }));

    expect(await screen.findByRole("dialog", { name: "Edit Overrides" })).toBeDefined();
  });

  it("hides override values outside defaultConfigPrefix", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          filters: { defaultConfigPrefix: "app." },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Expand override details for ctx-1" }),
    );

    expect(document.body.textContent).toContain("app.title");
    expect(document.body.textContent).not.toContain("feature.enabled");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.com/context?page=1&count=10&prefix=app.",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("does not include fixed scope when creating from the structured form", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: {
            context: { region: "us-east-1" },
          },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("Create override"));

    expect(screen.queryByText("Fixed Scope")).toBeNull();

    await chooseFromDropdown("Add Override", "app.title");
    fireEvent.change(screen.getByLabelText("app.title"), {
      target: { value: "Scoped App" },
    });

    fireEvent.change(screen.getByLabelText("Reason for Change*"), {
      target: { value: "test create" },
    });

    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.com/context",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            context: {},
            override: { "app.title": "Scoped App" },
            description: undefined,
            change_reason: "test create",
          }),
        }),
      );
    });
  });

  it("shows create validation only after a submit attempt", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: { context: { merchant_id: "m_123" } },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("Create override"));

    const createButton = screen.getByRole("button", { name: "Create" });
    expect(screen.queryByText("Add at least one override value.")).toBeNull();
    expect(screen.queryByText("Enter a reason for this change.")).toBeNull();

    fireEvent.click(createButton);

    expect(
      screen.getAllByText("Add at least one override value.").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Enter a reason for this change.").length).toBeGreaterThan(
      0,
    );

    await chooseFromDropdown("Add Override", "app.title");
    fireEvent.change(screen.getByLabelText("app.title"), {
      target: { value: "Scoped App" },
    });

    fireEvent.change(screen.getByLabelText("Reason for Change*"), {
      target: { value: "test create" },
    });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.com/context",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            context: {},
            override: { "app.title": "Scoped App" },
            description: undefined,
            change_reason: "test create",
          }),
        }),
      );
    });
  });

  it("allows context editing when update capability is enabled", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          capabilities: { overrides: { create: true, update: true } },
          scope: {
            context: { region: "us-east-1" },
          },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("Create override"));

    expect(screen.getByRole("button", { name: "Add Context" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add Override" })).toBeDefined();
  });

  it("hides mutating actions when capabilities are explicitly disabled", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          capabilities: {
            overrides: { create: false, update: false },
          },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("region:us-east-1").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Create override")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit override ctx-1" })).toBeNull();
  });

  it("hides mutating actions in read-only mode", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          readOnly: true,
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/read-only mode/i)).toBeDefined();
    });

    expect(screen.queryByText("Create override")).toBeNull();
    expect(screen.queryAllByText("Delete")).toHaveLength(0);
  });
});
