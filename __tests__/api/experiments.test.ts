import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SuperpositionClient } from "../../src/api/client";
import { experimentsApi } from "../../src/api/experiments";
import type { CreateExperimentRequest } from "../../src/types";

describe("experimentsApi", () => {
  const mockFetch = vi.fn();
  let api: ReturnType<typeof experimentsApi>;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    api = experimentsApi(
      new SuperpositionClient({
        apiBaseUrl: "https://superposition.test",
        orgId: "org",
        workspace: "ws",
      }),
    );
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "100" }),
      json: () => Promise.resolve({ total_pages: 1, total_items: 0, data: [] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists experiments with search, status, sorting, and pagination", async () => {
    await api.list(
      { page: 2, count: 10 },
      {
        experiment_name: "checkout",
        status: ["INPROGRESS"],
        sort_on: "last_modified_at",
        sort_by: "desc",
      },
    );

    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://superposition.test/experiments?page=2&count=10&experiment_name=checkout&status=INPROGRESS&sort_on=last_modified_at&sort_by=desc",
    );
  });

  it("gets an experiment using an encoded id", async () => {
    await api.get("checkout/a");
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://superposition.test/experiments/checkout%2Fa",
    );
  });

  it("creates an experiment", async () => {
    const request: CreateExperimentRequest = {
      name: "Checkout copy",
      context: { country: "US" },
      variants: [
        { id: "control", variant_type: "CONTROL", overrides: {} },
        {
          id: "treatment",
          variant_type: "EXPERIMENTAL",
          overrides: { "checkout.title": "Buy now" },
        },
      ],
      description: "Tests checkout copy",
      change_reason: "Initial experiment",
    };

    await api.create(request);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://superposition.test/experiments");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(request);
  });

  it.each([
    ["ramp", { traffic_percentage: 20, change_reason: "Start" }],
    ["pause", { change_reason: "Investigating" }],
    ["resume", { change_reason: "Continue" }],
    ["conclude", { chosen_variant: "treatment", change_reason: "Winner" }],
    ["discard", { change_reason: "Invalid result" }],
  ] as const)("calls the %s lifecycle endpoint", async (action, request) => {
    await api[action]("checkout/a", request as never);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`https://superposition.test/experiments/checkout%2Fa/${action}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual(request);
  });
});
