import { afterEach, describe, expect, it, vi } from "vitest";
import { SuperpositionClient } from "../../src/api/client";
import { workspacesApi } from "../../src/api/workspaces";

describe("workspacesApi", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gets the configured workspace using an encoded id", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "20" }),
      json: () => Promise.resolve({ metrics: { enabled: false } }),
    });
    vi.stubGlobal("fetch", mockFetch);
    const api = workspacesApi(
      new SuperpositionClient({
        apiBaseUrl: "https://superposition.test",
        orgId: "org",
        workspace: "checkout/ws",
      }),
    );

    await api.get();

    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://superposition.test/workspaces/checkout%2Fws",
    );
    expect(mockFetch.mock.calls[0][1].method).toBe("GET");
  });
});
