import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SuperpositionClient } from "../../src/api/client";
import { resolveApi } from "../../src/api/resolve";

describe("resolveApi", () => {
  const mockFetch = vi.fn();
  const client = new SuperpositionClient({
    apiBaseUrl: "https://superposition.test",
    orgId: "test-org",
    workspace: "test-ws",
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "2" }),
      json: () => Promise.resolve({ ok: true }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /config/resolve with context in the request body", async () => {
    const api = resolveApi(client);

    await api.resolve({ region: "ap-south-1", city: "blr" }, "MERGE");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://superposition.test/config/resolve?merge_strategy=MERGE");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({ context: { region: "ap-south-1", city: "blr" } }),
    );
  });

  it("calls POST /config/resolve/detailed and normalizes detailed config rows", async () => {
    const api = resolveApi(client);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "300" }),
      json: () =>
        Promise.resolve({
          "checkout.title": {
            value: "Fast Checkout",
            schema: { type: "string" },
            description: "Checkout title",
          },
        }),
    });

    await expect(
      api.resolveDetailed(
        { region: "ap-south-1" },
        { prefix: ["checkout."], mergeStrategy: "MERGE" },
      ),
    ).resolves.toMatchObject({
      total_pages: 1,
      total_items: 1,
      data: [
        {
          key: "checkout.title",
          value: "Fast Checkout",
          schema: { type: "string" },
          description: "Checkout title",
        },
      ],
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://superposition.test/config/resolve/detailed?prefix=checkout.&merge_strategy=MERGE",
    );
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ context: { region: "ap-south-1" } }));
  });

  it("calls POST /config/resolve/explain with context and explain options", async () => {
    const api = resolveApi(client);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "300" }),
      json: () =>
        Promise.resolve({
          key: "checkout.title",
          timeline: [],
        }),
    });

    await expect(
      api.explain(
        "checkout.title",
        { region: "ap-south-1" },
        {
          version: "v1",
          contextId: "ctx_123",
          resolveRemote: true,
          mergeStrategy: "MERGE",
        },
      ),
    ).resolves.toEqual({
      key: "checkout.title",
      timeline: [],
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://superposition.test/config/resolve/explain/checkout.title?version=v1&context_id=ctx_123&resolve_remote=true",
    );
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ context: { region: "ap-south-1" } }));
    expect(init.headers["x-merge-strategy"]).toBe("MERGE");
  });

  it("calls GET /config for the cached config contract", async () => {
    const api = resolveApi(client);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "200" }),
      json: () =>
        Promise.resolve({
          contexts: [],
          overrides: {},
          default_configs: { "checkout.title": "Default title" },
        }),
    });

    await expect(api.getConfig({ region: "ap-south-1" })).resolves.toEqual({
      contexts: [],
      overrides: {},
      default_configs: { "checkout.title": "Default title" },
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://superposition.test/config?dimension[region]=ap-south-1");
    expect(init.method).toBe("GET");
  });
});
