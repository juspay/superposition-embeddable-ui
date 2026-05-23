import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditTrail } from "../../src/pages/AuditTrail";
import { AlertProvider } from "../../src/providers/AlertProvider";
import { SuperpositionUIProvider } from "../../src/providers/SuperpositionUIProvider";

const testConfig = {
  apiBaseUrl: "https://test.com",
  orgId: "org",
  workspace: "ws",
};

const mockAuditLogs = {
  total_pages: 1,
  total_items: 2,
  data: [
    {
      id: "audit-1",
      table_name: "contexts",
      user_name: "alice",
      timestamp: "2024-01-01T08:30:00.000Z",
      action: "UPDATE",
      original_data: {
        value: { region: "us", env: "prod" },
        override: { "app.title": "Old title" },
      },
      new_data: {
        value: { region: "us", env: "prod" },
        override: { "app.title": "New title" },
      },
      query: 'UPDATE contexts SET override = \'{"app.title":"New title"}\'',
    },
    {
      id: "audit-2",
      table_name: "default_configs",
      user_name: "bob",
      timestamp: "2024-01-02T10:45:00.000Z",
      action: "INSERT",
      original_data: null,
      new_data: {
        value: { region: "eu", env: "prod" },
        key: "feature.enabled",
        enabled: true,
      },
      query: "INSERT INTO default_configs (key, value) VALUES ('feature.enabled', true)",
    },
  ],
};

function auditDayStart(value: Date): string {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

function auditDayEnd(value: Date): string {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next.toISOString();
}

describe("AuditTrail", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "500" }),
      json: () => Promise.resolve(mockAuditLogs),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a compact empty state when there are no audit events", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "64" }),
      json: () =>
        Promise.resolve({
          total_pages: 0,
          total_items: 0,
          data: [],
        }),
    });

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <AuditTrail />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    expect(await screen.findByText("No audit events found")).toBeDefined();
    const emptyState = screen.getByRole("status", { name: "No audit events found" });
    expect(emptyState.tagName).toBe("DIV");
    expect(emptyState).not.toHaveStyle({
      border: "1px solid var(--sp-color-border)",
    });
    expect(
      screen.getByText("No audit activity matched the current filters."),
    ).toBeDefined();
  });

  it("renders audit events with both inline expand and dedicated detail view", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <AuditTrail />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Audit Trail" })).toBeDefined();
      expect(
        screen.getByText(
          "Track inserts, updates, deletes, and compare changes across configuration tables.",
        ),
      ).toBeDefined();
      expect(screen.getAllByText("contexts").length).toBeGreaterThan(0);
      expect(
        screen.getAllByRole("button", { name: /Open audit detail|Open/ }).length,
      ).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Audit log entries")).toBeNull();
    expect(screen.queryByPlaceholderText("Filter by username")).toBeNull();
    expect(screen.queryByText("alice")).toBeNull();
    expect(screen.getByPlaceholderText("Search audit records...")).toBeDefined();
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeDefined();
    expect(screen.getByText("INSERT")).toBeDefined();
    expect(screen.getByText("UPDATE")).toBeDefined();
    expect(screen.queryByRole("columnheader", { name: "Original Data" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "New Data" })).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Date range/i }));
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.click(screen.getAllByRole("button", { name: "Expand row" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Showing first 50 differences")).toBeDefined();
      expect(screen.getByText("Original Data / New Data")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Collapse row" }));

    await waitFor(() => {
      expect(screen.queryByText("Showing first 50 differences")).toBeNull();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Open audit detail|Open/ })[0]);

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Navigate to Audit Trail/i }),
      ).toBeDefined();
      expect(screen.getByText("Changes")).toBeDefined();
      expect(screen.getByText("override.app.title")).toBeDefined();
      expect(screen.getByText(/Old title/)).toBeDefined();
      expect(screen.getByText(/New title/)).toBeDefined();
      expect(screen.queryByText("Change Summary")).toBeNull();
      expect(screen.queryByText("Additional Information")).toBeNull();
    });

    fireEvent.click(screen.getByRole("link", { name: /Navigate to Audit Trail/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Audit Trail" })).toBeDefined();
    });

    expect(screen.queryByText(/UPDATE contexts SET override/i)).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).toBeNull();
    expect(screen.queryByText("Compare")).toBeNull();
  });

  it("searches audit records across users and payload data", async () => {
    const user = userEvent.setup();

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <AuditTrail />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("contexts").length).toBeGreaterThan(0);
    });

    await user.type(screen.getByPlaceholderText("Search audit records..."), "bob");

    await waitFor(() => {
      expect(screen.getAllByText("default_configs").length).toBeGreaterThan(0);
      expect(screen.queryByText("contexts")).toBeNull();
      expect(screen.queryByText("UPDATE")).toBeNull();
    });

    expect(mockFetch.mock.calls.some(([url]) => String(url).includes("all=true"))).toBe(
      true,
    );
  });

  it("passes host scope to the audit API as dimension params", async () => {
    render(
      <SuperpositionUIProvider
        config={{
          ...testConfig,
          scope: { context: { region: "us", merchant_id: "merchant_123" } },
        }}
      >
        <AlertProvider>
          <AuditTrail pageSize={1} />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("contexts").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Host scope")).toBeNull();
    expect(screen.queryByPlaceholderText("Filter by username")).toBeNull();
    expect(screen.queryByText("alice")).toBeNull();
    expect(screen.queryByText("bob")).toBeNull();
    expect(screen.queryByText(/Page 1 of 1/i)).toBeNull();
    const [auditUrl, requestInit] =
      mockFetch.mock.calls.find(([url]) =>
        String(url).startsWith("https://test.com/audit?"),
      ) ?? [];
    expect(auditUrl).toBeDefined();
    expect(auditUrl).toContain("page=1");
    expect(auditUrl).toContain("count=1");
    expect(auditUrl).toContain("dimension[region]=us");
    expect(auditUrl).toContain("dimension[merchant_id]=merchant_123");
    expect(auditUrl).toContain("sort_by=desc");
    expect(requestInit).toEqual(expect.objectContaining({ method: "GET" }));
  });

  it("passes host filters to the audit API and renders only matching rows", async () => {
    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <AuditTrail
            filters={{
              dateRange: {
                startDate: new Date("2024-01-01T00:00:00.000Z"),
                endDate: new Date("2024-01-01T23:59:59.999Z"),
              },
              tables: ["contexts"],
              actions: ["UPDATE"],
            }}
          />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Audit Trail" })).toBeDefined();
      expect(screen.getAllByText("contexts").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("default_configs")).toBeNull();
    expect(screen.queryByText("INSERT")).toBeNull();

    const [auditUrl, requestInit] =
      mockFetch.mock.calls.find(([url]) =>
        String(url).startsWith("https://test.com/audit?"),
      ) ?? [];
    expect(auditUrl).toBeDefined();
    const parsedAuditUrl = new URL(String(auditUrl));
    expect(parsedAuditUrl.searchParams.get("from_date")).toBe(
      auditDayStart(new Date("2024-01-01T00:00:00.000Z")),
    );
    expect(parsedAuditUrl.searchParams.get("to_date")).toBe(
      auditDayEnd(new Date("2024-01-01T23:59:59.999Z")),
    );
    expect(auditUrl).toContain("table=contexts");
    expect(auditUrl).toContain("action=UPDATE");
    expect(requestInit).toEqual(expect.objectContaining({ method: "GET" }));
  });

  it("sends audit date filters as whole-day bounds", async () => {
    const startDate = new Date("2024-01-01T12:34:56.000Z");
    const endDate = new Date("2024-01-02T08:15:00.000Z");

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <AuditTrail
            filters={{
              dateRange: {
                startDate,
                endDate,
              },
            }}
          />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("contexts").length).toBeGreaterThan(0);
    });

    const [auditUrl] =
      mockFetch.mock.calls.find(([url]) =>
        String(url).startsWith("https://test.com/audit?"),
      ) ?? [];
    expect(auditUrl).toBeDefined();
    const parsedAuditUrl = new URL(String(auditUrl));
    expect(parsedAuditUrl.searchParams.get("from_date")).toBe(auditDayStart(startDate));
    expect(parsedAuditUrl.searchParams.get("to_date")).toBe(auditDayEnd(endDate));
  });

  it("does not refetch all audit rows when paging locally", async () => {
    const startDate = new Date("2024-01-01T00:00:00.000Z");
    const endDate = new Date("2024-01-02T23:59:59.999Z");

    render(
      <SuperpositionUIProvider config={testConfig}>
        <AlertProvider>
          <AuditTrail
            pageSize={1}
            filters={{
              dateRange: {
                startDate,
                endDate,
              },
            }}
          />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("contexts").length).toBeGreaterThan(0);
      expect(screen.getByRole("navigation", { name: "Pagination" })).toBeDefined();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const parsedAuditUrl = new URL(String(mockFetch.mock.calls[0][0]));
    expect(parsedAuditUrl.searchParams.get("all")).toBe("true");
    expect(parsedAuditUrl.searchParams.get("from_date")).toBe(auditDayStart(startDate));
    expect(parsedAuditUrl.searchParams.get("to_date")).toBe(auditDayEnd(endDate));

    fireEvent.click(screen.getByRole("button", { name: /Next page/i }));

    await waitFor(() => {
      expect(screen.getAllByText("default_configs").length).toBeGreaterThan(0);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
