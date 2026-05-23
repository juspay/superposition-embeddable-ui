import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogsApi } from "../../src/api/audit-logs";
import { SuperpositionClient } from "../../src/api/client";

describe("auditLogsApi", () => {
  const mockFetch = vi.fn();
  let client: SuperpositionClient;

  beforeEach(() => {
    client = new SuperpositionClient({
      apiBaseUrl: "https://superposition.test",
      orgId: "test-org",
      workspace: "test-ws",
    });
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "2" }),
      json: () =>
        Promise.resolve({
          total_pages: 1,
          total_items: 0,
          data: [],
        }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps smithy audit log filters to the /audit query contract", async () => {
    const api = auditLogsApi(client);

    await api.list(
      { page: 2, count: 25 },
      {
        from_date: new Date("2024-05-01T00:00:00.000Z"),
        to_date: new Date("2024-05-02T23:59:59.999Z"),
        tables: ["contexts", "default_configs"],
        action: ["UPDATE"],
        username: "alice",
        dimension_params: {
          "dimension[cid]": "swiggy",
          "dimension[merchant_id]": "merchant_123",
        },
        sort_by: "asc",
      },
    );

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("https://superposition.test/audit?");
    expect(url).toContain("page=2");
    expect(url).toContain("count=25");
    expect(url).toContain("table=contexts,default_configs");
    expect(url).toContain("action=UPDATE");
    expect(url).toContain("username=alice");
    expect(url).toContain("dimension[cid]=swiggy");
    expect(url).toContain("dimension[merchant_id]=merchant_123");
    expect(url).toContain("sort_by=asc");
    expect(url).toContain("from_date=2024-05-01T00%3A00%3A00.000Z");
    expect(url).toContain("to_date=2024-05-02T23%3A59%3A59.999Z");
  });

  it("normalizes missing audit data to an empty page", async () => {
    const api = auditLogsApi(client);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "20" }),
      json: () => Promise.resolve({ total_pages: 0, total_items: 0 }),
    });

    await expect(api.list()).resolves.toEqual({
      total_pages: 0,
      total_items: 0,
      data: [],
    });
  });

  it("returns an empty page when backend reports no audit records", async () => {
    const api = auditLogsApi(client);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            message: "No records found. Please refine or correct your search parameters",
          }),
        ),
    });

    await expect(api.list()).resolves.toEqual({
      total_pages: 0,
      total_items: 0,
      data: [],
    });
  });
});
