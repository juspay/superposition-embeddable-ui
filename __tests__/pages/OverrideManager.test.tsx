import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverrideManager } from "../../src/pages/OverrideManager";
import { AlertProvider } from "../../src/providers/AlertProvider";
import { SuperpositionUIProvider } from "../../src/providers/SuperpositionUIProvider";

const testConfig = {
  apiBaseUrl: "https://test.com",
  orgId: "org",
  workspace: "ws",
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

function chooseFromDropdown(label: string, value: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: value }));
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
      expect(screen.getByText("US App")).toBeDefined();
    });
    expect(screen.getAllByText("And")).toHaveLength(4);
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
    expect(screen.queryByPlaceholderText("Search overrides")).toBeNull();
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
          capabilities: { overrides: { editContext: true } },
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
    expect(screen.getByRole("button", { name: "Create" })).toBeDefined();
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
          capabilities: { overrides: { editContext: true } },
        }}
      >
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByText("Create override"));

    chooseFromDropdown("Add Context", "region");
    fireEvent.change(screen.getByLabelText("region"), {
      target: { value: "us-east-1" },
    });
    chooseFromDropdown("Add Override", "app.title");
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
    expect(screen.getByText(/server down/)).toBeDefined();
    expect(screen.queryByText("No overrides found")).toBeNull();
    expect(screen.queryByText("!")).toBeNull();
    expect(screen.queryByText(/context\?/)).toBeNull();
    expect(screen.queryByPlaceholderText("Search overrides")).toBeNull();
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
  });

  it("shows a concise delete confirmation without exposing the override id", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <OverrideManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Delete override ctx-1" }));

    expect(screen.getByRole("dialog", { name: "Delete override?" })).toBeDefined();
    expect(screen.getByText("This will permanently remove this override.")).toBeDefined();
    expect(screen.queryByText(/context "ctx-1"/)).toBeNull();
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
      expect(screen.getByText("Fixed Scope")).toBeDefined();
    });

    expect(screen.getByText("US App")).toBeDefined();
    expect(screen.queryByText("EU App")).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.com/context?page=1&count=20&dimension[region]=us-east-1&dimension_match_strategy=subset",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("uses exact context filtering when strict is enabled", async () => {
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
      expect(screen.getByText("Fixed Scope")).toBeDefined();
    });

    expect(screen.getByText("US App")).toBeDefined();
    expect(screen.queryByText("EU App")).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.com/context?page=1&count=20&dimension[region]=us-east-1&dimension_match_strategy=exact",
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
      expect(screen.getByText("US App")).toBeDefined();
    });

    // Both overrides have region: us-east-1 matching the scope
    expect(screen.getByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit override ctx-3" })).toBeDefined();
  });

  it("shows edit controls only for overrides that include all scoped dimensions", async () => {
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
    // ctx-3 only has region, missing env — not editable from this scope
    expect(screen.queryByRole("button", { name: "Edit override ctx-3" })).toBeNull();
  });

  it("uses scoped context to gate edits", async () => {
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
      expect(screen.getByText("Env App")).toBeDefined();
    });

    // Only overrides matching the scoped context can be edited
    expect(screen.queryByRole("button", { name: "Edit override ctx-1" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Edit override ctx-3" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit override ctx-4" })).toBeNull();
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
      expect(screen.getByText("US App")).toBeDefined();
    });

    expect(document.body.textContent).toContain("app.title");
    expect(document.body.textContent).not.toContain("feature.enabled");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.com/context?page=1&count=20&prefix=app.",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("creates a scoped override from the structured form", async () => {
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

    // The scoped context (region: us-east-1) is already locked in, so just add an override
    chooseFromDropdown("Add Override", "app.title");
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
            context: { region: "us-east-1" },
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

    chooseFromDropdown("Add Override", "app.title");
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
            context: { merchant_id: "m_123" },
            override: { "app.title": "Scoped App" },
            description: undefined,
            change_reason: "test create",
          }),
        }),
      );
    });
  });

  it("allows context editing when editContext capability is enabled", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          capabilities: { overrides: { editContext: true } },
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
      expect(screen.getByText("US App")).toBeDefined();
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
