import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExperimentManager } from "../../src/pages/ExperimentManager";
import { AlertProvider } from "../../src/providers/AlertProvider";
import { SuperpositionUIProvider } from "../../src/providers/SuperpositionUIProvider";
import type { SuperpositionExperimentManagerConfig } from "../../src/types";

const response = {
  total_pages: 1,
  total_items: 1,
  data: [
    {
      id: "checkout-copy",
      name: "Checkout copy",
      status: "INPROGRESS",
      traffic_percentage: 25,
      variants: [{ id: "control" }, { id: "treatment" }],
      context: { country: "US" },
      last_modified: "2026-08-25T10:00:00Z",
      description: "Tests shorter checkout copy",
      metrics: {
        enabled: true,
        selection: {
          primary: { name: "conversion_rate", direction: "maximize" },
          secondary: null,
          guardrail: "latency_p95",
          hypothesis: "Improve conversion safely",
        },
      },
      metrics_url: "https://grafana.example/experiment/checkout-copy",
    },
  ],
};

const workspace = {
  metrics: {
    enabled: true,
    definitions: [
      { name: "conversion_rate", direction: "maximize" },
      { name: "latency_p95", direction: "minimize" },
    ],
  },
};

describe("ExperimentManager", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "200" }),
        json: () =>
          Promise.resolve(
            url.includes("/workspaces/")
              ? workspace
              : url.includes("?")
                ? response
                : response.data[0],
          ),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderManager(experimentManager?: SuperpositionExperimentManagerConfig) {
    return render(
      <SuperpositionUIProvider
        config={{
          apiBaseUrl: "/api",
          orgId: "org",
          workspace: "ws",
          capabilities: {
            experiments: { create: true, execute: true, ramp: true },
          },
          experimentManager: experimentManager ?? {
            variantFields: [
              {
                key: "topBarBackgroundColor",
                label: "Top bar background color",
                type: "color",
                controlValue: "#FFFFFF",
              },
              {
                key: "iconStyle",
                label: "Icon style",
                type: "choice",
                controlValue: "outline",
                options: [
                  { label: "Outline", value: "outline" },
                  { label: "Filled", value: "filled" },
                ],
              },
            ],
            comparisonUrls: ["https://checkout.example/control"],
          },
        }}
      >
        <AlertProvider>
          <ExperimentManager />
        </AlertProvider>
      </SuperpositionUIProvider>,
    );
  }

  // Experiment details moved off the removed step-4 page onto step 1, so every wizard walk
  // must satisfy them before the first Next.
  const fillStepOneDetails = (name = "Test experiment") => {
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: name } });
    const description = screen.queryByLabelText(/Description/);
    if (description) {
      fireEvent.change(description, { target: { value: "Description" } });
    }
    const reason = screen.queryByLabelText(/Change reason/);
    if (reason) {
      fireEvent.change(reason, { target: { value: "Reason" } });
    }
  };

  it("loads a template's configuration keys before configuring variants", async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "200" }),
        json: () =>
          Promise.resolve(
            url.includes("/default-config")
              ? {
                  total_pages: 1,
                  total_items: 2,
                  data: [
                    {
                      key: "topBarBackgroundColor",
                      value: "#FFFFFF",
                      schema: { type: "string" },
                    },
                    {
                      key: "iconStyle",
                      value: "outline",
                      schema: { type: "string", enum: ["outline", "filled"] },
                    },
                  ],
                }
              : url.includes("/workspaces/")
                ? { metrics: { enabled: false, definitions: [] } }
                : url.includes("?")
                  ? response
                  : response.data[0],
          ),
      }),
    );

    renderManager({
      showMetricsForm: false,
      experimentTemplates: [
        {
          id: "theme",
          label: "Theme customization",
          keys: ["topBarBackgroundColor", "iconStyle"],
        },
      ],
    });
    await screen.findByText("Checkout copy");

    fireEvent.click(screen.getByRole("button", { name: /Create Experiment/i }));
    fireEvent.click(screen.getByRole("button", { name: "Theme customization" }));

    expect(await screen.findByDisplayValue("#FFFFFF")).toBeDefined();
    expect(screen.getByRole("radiogroup", { name: /Icon style/i })).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/default-config?all=true",
      expect.anything(),
    );

    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: "Theme test" },
    });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "Theme description" },
    });
    fireEvent.change(screen.getByLabelText(/Change reason/), {
      target: { value: "Theme reason" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next →" }));
    fireEvent.click(screen.getByRole("button", { name: "Review & Launch" }));
    fireEvent.click(screen.getByRole("button", { name: "Launch" }));

    await waitFor(() => {
      const createCall = mockFetch.mock.calls.find(([, init]) => init.method === "POST");
      expect(JSON.parse(createCall?.[1].body).variants).toEqual([
        {
          id: "control",
          variant_type: "CONTROL",
          overrides: { topBarBackgroundColor: "#FFFFFF", iconStyle: "outline" },
        },
        {
          id: "treatment",
          variant_type: "EXPERIMENTAL",
          overrides: { topBarBackgroundColor: "#FFFFFF", iconStyle: "outline" },
        },
      ]);
    });
  });

  it("renders the experiment summary and list", async () => {
    renderManager();

    expect(await screen.findByText("Checkout copy")).toBeDefined();
    expect(screen.getByText("Active")).toBeDefined();
    expect(screen.getByText("Running")).toBeDefined();
    expect(screen.getByText("Scheduled")).toBeDefined();
    expect(screen.getByText("Ended")).toBeDefined();
  });

  it("renders one create action in the empty state", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "20" }),
      json: () => Promise.resolve({ total_pages: 0, total_items: 0, data: [] }),
    });

    renderManager();

    expect(await screen.findByText("No experiments created")).toBeDefined();
    expect(screen.getAllByRole("button", { name: /Create Experiment/i })).toHaveLength(1);
    expect(screen.getAllByText("–")).toHaveLength(4);
  });

  it("renders host-provided Control and Variant comparison URLs", async () => {
    renderManager({
      variantFields: [
        { key: "theme", label: "Theme", type: "text", controlValue: "default" },
      ],
      comparisonUrls: [
        "/live-preview?shopUrl=shop.example&tm=true&tkn=preview-session",
        "/live-preview?shopUrl=shop.example&tm=true&tkn=preview-session",
      ],
    });
    await screen.findByText("Checkout copy");

    fireEvent.click(screen.getByRole("button", { name: /Create Experiment/i }));

    const variantTab = screen.getByRole("tab", { name: "Variant" });
    expect(variantTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTitle("Variant checkout preview")).toHaveAttribute(
      "src",
      "/live-preview?shopUrl=shop.example&tm=true&tkn=preview-session",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Control" }));
    expect(screen.getByTitle("Control checkout preview")).toBeDefined();
  });

  it("hides audience context when it is managed by the host", async () => {
    renderManager({
      contextMode: "host-managed",
      variantFields: [
        { key: "theme", label: "Theme", type: "text", controlValue: "default" },
      ],
    });
    await screen.findByText("Checkout copy");

    fireEvent.click(screen.getByRole("button", { name: /Create Experiment/i }));
    // Details, including the audience field, are on step 1 now — so host-managed hiding and
    // the incomplete-details gate are both observable without walking the wizard.
    expect(screen.queryByLabelText("Audience context (JSON)")).toBeNull();
    expect(screen.getByRole("button", { name: "Next →" })).toBeDisabled();
  });

  it.each([false, true])(
    "blocks submission for missing choices with disableGuardrailMetric=%s",
    async (disableGuardrailMetric) => {
      mockFetch.mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "20" }),
          json: () =>
            Promise.resolve(
              url.includes("/workspaces/")
                ? { metrics: { enabled: false, definitions: [] } }
                : response,
            ),
        }),
      );
      renderManager({
        disableGuardrailMetric,
        variantFields: [
          { key: "theme", label: "Theme", type: "text", controlValue: "default" },
        ],
      });
      await screen.findByText("Checkout copy");

      fireEvent.click(screen.getByRole("button", { name: /Create Experiment/i }));
      fillStepOneDetails();
      fireEvent.click(screen.getByRole("button", { name: "Next →" }));

      expect(screen.queryByRole("checkbox", { name: "Experiment Metrics" })).toBeNull();
      expect(screen.getByText(/No metric choices are configured/)).toBeDefined();
      expect(screen.getByRole("radiogroup", { name: "Primary metric" })).toBeDefined();
      expect(screen.getByLabelText("Hypothesis")).toBeDefined();
      expect(screen.getByRole("button", { name: "Next →" })).toBeDisabled();
    },
  );

  it("locks the workspace-backed primary metric when configured by the host", async () => {
    renderManager({
      disablePrimaryMetricSelection: true,
      variantFields: [
        { key: "theme", label: "Theme", type: "text", controlValue: "default" },
      ],
    });
    await screen.findByText("Checkout copy");
    fireEvent.click(screen.getByRole("button", { name: /Create Experiment/i }));
    fillStepOneDetails();
    fireEvent.click(screen.getByRole("button", { name: "Next →" }));

    const primaryOptions = await screen.findAllByRole("radio");
    expect(primaryOptions).toHaveLength(2);
    expect(primaryOptions.every((option) => option.hasAttribute("disabled"))).toBe(true);
    expect(primaryOptions[0]).toBeChecked();
  });

  it.each([true, false])(
    "creates with metrics when workspace metrics enabled is %s",
    async (enabled) => {
      mockFetch.mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "200" }),
          json: () =>
            Promise.resolve(
              url.includes("/workspaces/")
                ? { metrics: { ...workspace.metrics, enabled } }
                : url.includes("?")
                  ? response
                  : response.data[0],
            ),
        }),
      );
      renderManager();
      await screen.findByText("Checkout copy");

      fireEvent.click(screen.getByRole("button", { name: /Create Experiment/i }));
      fireEvent.change(screen.getByLabelText(/Name/), {
        target: { value: "Payment button test" },
      });
      expect(screen.queryByLabelText(/Description/)).toBeNull();
      expect(screen.queryByLabelText(/Change reason/)).toBeNull();
      fireEvent.change(screen.getByLabelText("Top bar background color"), {
        target: { value: "#112233" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Next →" }));
      expect(screen.queryByRole("checkbox", { name: "Experiment Metrics" })).toBeNull();
      expect(screen.getByRole("radio", { name: /Conversion Rate/i })).toBeChecked();
      expect(screen.getByRole("button", { name: "Next →" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Guardrail metric" }));
      fireEvent.click(screen.getByRole("option", { name: "Conversion Rate" }));
      fireEvent.change(screen.getByLabelText("Hypothesis"), {
        target: { value: "Conversion should improve" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Next →" }));
      // Traffic is a capped slider now, so an over-subscribed split cannot be expressed at
      // all rather than being rejected after the fact.
      expect(screen.getByRole("radio", { name: /Even split/i })).toBeChecked();
      fireEvent.click(screen.getByRole("radio", { name: /Custom split/i }));
      const trafficSlider = screen.getByLabelText(/Traffic per variant/);
      expect(trafficSlider).toHaveAttribute("min", "1");
      expect(trafficSlider).toHaveAttribute("max", "50");
      fireEvent.change(trafficSlider, { target: { value: "30" } });
      expect(screen.getByText("Control: 70% / Variant B: 30%")).toBeDefined();
      fireEvent.click(screen.getByRole("radio", { name: /Even split/i }));
      fireEvent.click(screen.getByRole("button", { name: "Review & Launch" }));
      expect(
        await screen.findByRole("dialog", { name: "Review your experiment" }),
      ).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Launch" }));

      await waitFor(() => {
        const createCall = mockFetch.mock.calls.find(
          ([, init]) => init.method === "POST",
        );
        expect(createCall?.[0]).toBe("/api/experiments");
        expect(JSON.parse(createCall?.[1].body)).toMatchObject({
          name: "Payment button test",
          variants: [
            {
              id: "control",
              variant_type: "CONTROL",
              overrides: { topBarBackgroundColor: "#FFFFFF", iconStyle: "outline" },
            },
            {
              id: "treatment",
              variant_type: "EXPERIMENTAL",
              overrides: { topBarBackgroundColor: "#112233", iconStyle: "outline" },
            },
          ],
          metrics: {
            enabled: true,
            selection: {
              primary: { name: "conversion_rate", direction: "maximize" },
              secondary: null,
              guardrail: "conversion_rate",
              hypothesis: "Conversion should improve",
            },
          },
          description: "Conversion should improve",
          change_reason: "Conversion should improve",
        });
        expect(
          mockFetch.mock.calls.some(
            ([url, init]) =>
              url === "/api/experiments/checkout-copy/ramp" &&
              init.method === "PATCH" &&
              JSON.parse(init.body).change_reason === "Conversion should improve",
          ),
        ).toBe(true);
      });
    },
  );

  it.each([true, false])(
    "explicitly disables metrics when hidden and workspace enabled is %s",
    async (enabled) => {
      mockFetch.mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "20" }),
          json: () =>
            Promise.resolve(
              url.includes("/workspaces/")
                ? { metrics: { ...workspace.metrics, enabled } }
                : url.includes("?")
                  ? response
                  : response.data[0],
            ),
        }),
      );
      renderManager({
        showMetricsForm: false,
        variantFields: [
          { key: "theme", label: "Theme", type: "text", controlValue: "default" },
        ],
      });
      await screen.findByText("Checkout copy");
      fireEvent.click(screen.getByRole("button", { name: /Create Experiment/i }));
      fillStepOneDetails("No metrics");
      fireEvent.click(screen.getByRole("button", { name: "Next →" }));
      expect(screen.queryByRole("radiogroup", { name: "Primary metric" })).toBeNull();
      expect(screen.queryByText("Hypothesis & Metrics")).toBeNull();
      expect(screen.getByLabelText("Step 2 of 3")).toBeDefined();
      expect(screen.getByRole("radiogroup", { name: "Traffic split" })).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByLabelText("Step 1 of 3")).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Next →" }));
      fireEvent.click(screen.getByRole("button", { name: "Review & Launch" }));
      fireEvent.click(screen.getByRole("button", { name: "Launch" }));

      await waitFor(() => {
        const createCall = mockFetch.mock.calls.find(
          ([, init]) => init.method === "POST",
        );
        expect(JSON.parse(createCall?.[1].body).metrics).toEqual({ enabled: false });
      });
    },
  );

  it.each([false, true])(
    "creates without a hypothesis with disableGuardrailMetric=%s",
    async (disableGuardrailMetric) => {
      renderManager({
        disableGuardrailMetric,
        variantFields: [
          { key: "theme", label: "Theme", type: "text", controlValue: "default" },
        ],
      });
      await screen.findByText("Checkout copy");
      fireEvent.click(screen.getByRole("button", { name: /Create Experiment/i }));
      fillStepOneDetails("Metric defaults");
      fireEvent.click(screen.getByRole("button", { name: "Next →" }));
      if (disableGuardrailMetric) {
        expect(screen.queryByRole("button", { name: "Guardrail metric" })).toBeNull();
        expect(screen.queryByText("Guardrail Metric")).toBeNull();
        expect(screen.getByRole("radio", { name: /Conversion Rate/i })).toBeChecked();
        fireEvent.click(screen.getByRole("radio", { name: /Latency P95/i }));
        expect(screen.getByRole("button", { name: "Next →" })).not.toBeDisabled();
      } else {
        expect(screen.getByRole("button", { name: "Next →" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Guardrail metric" }));
        fireEvent.click(screen.getByRole("option", { name: "Latency P95" }));
      }
      fireEvent.click(screen.getByRole("button", { name: "Next →" }));
      fireEvent.click(screen.getByRole("button", { name: "Review & Launch" }));
      const review = within(
        screen.getByRole("dialog", { name: "Review your experiment" }),
      );
      // The review modal no longer surfaces a guardrail cell; it still has to name the
      // primary metric, and the payload assertion below still proves guardrail is sent.
      expect(review.queryByText(/Guardrail/)).toBeNull();
      expect(
        review.getByText(disableGuardrailMetric ? "Latency P95" : "Conversion Rate"),
      ).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Launch" }));

      await waitFor(() => {
        const createCall = mockFetch.mock.calls.find(
          ([, init]) => init.method === "POST",
        );
        expect(JSON.parse(createCall?.[1].body)).toMatchObject({
          description: "Description not provided",
          change_reason: "Change Reason not provided",
          metrics: {
            enabled: true,
            selection: {
              primary: disableGuardrailMetric
                ? { name: "latency_p95", direction: "minimize" }
                : { name: "conversion_rate", direction: "maximize" },
              guardrail: disableGuardrailMetric
                ? workspace.metrics.definitions[0].name
                : "latency_p95",
              hypothesis: null,
            },
          },
        });
        expect(
          mockFetch.mock.calls.some(
            ([url, init]) =>
              url === "/api/experiments/checkout-copy/ramp" &&
              init.method === "PATCH" &&
              JSON.parse(init.body).change_reason === "Change Reason not provided",
          ),
        ).toBe(true);
      });
    },
  );

  it("opens the single-page detail on Results and exposes valid lifecycle actions", async () => {
    renderManager();

    fireEvent.click(await screen.findByText("Checkout copy"));
    expect(await screen.findByRole("heading", { name: "Checkout copy" })).toBeDefined();
    expect(screen.queryByRole("dialog", { name: "Checkout copy" })).toBeNull();
    expect(
      within(screen.getByRole("navigation", { name: "Experiment detail sections" }))
        .getAllByRole("button")
        .map((tab) => tab.textContent),
    ).toEqual(["overview", "results"]);
    expect(screen.getByRole("button", { name: "results" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTitle("Experiment analytics")).toHaveAttribute(
      "src",
      "https://grafana.example/experiment/checkout-copy",
    );

    fireEvent.click(screen.getByRole("button", { name: "overview" }));
    expect(screen.getByText("Improve conversion safely")).toBeDefined();
    expect(screen.getByText("Latency P95")).toBeDefined();
    expect(screen.getByRole("button", { name: "Pause" })).toBeDefined();
    expect(screen.getByRole("button", { name: "End Experiment" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const actionRegion = screen.getByRole("region", { name: "Pause configuration" });
    fireEvent.change(screen.getByLabelText(/Change reason/), {
      target: { value: "Reviewing results" },
    });
    fireEvent.click(within(actionRegion).getByRole("button", { name: "Pause" }));

    await waitFor(() => {
      expect(
        mockFetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/experiments/checkout-copy/pause" && init.method === "PATCH",
        ),
      ).toBe(true);
    });
  });

  it("renders host-supplied structured analytics without deriving a winner", async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-length": "200" }),
        json: () =>
          Promise.resolve(
            url === "/experiment-results/checkout-copy"
              ? {
                  status: "available",
                  banner: {
                    tone: "success",
                    title: "Host analytics reports a favourable result",
                  },
                  primaryMetric: {
                    name: "conversion_rate",
                    label: "Conversion Rate",
                    control: 0.52,
                    variant: 0.58,
                    controlDisplay: "52%",
                    variantDisplay: "58%",
                    changeDisplay: "+11.5%",
                    favorable: true,
                  },
                  metrics: [
                    {
                      name: "conversion_rate",
                      label: "Conversion Rate",
                      control: 0.52,
                      variant: 0.58,
                      controlDisplay: "52%",
                      variantDisplay: "58%",
                      changeDisplay: "+11.5%",
                      favorable: true,
                    },
                  ],
                }
              : url.includes("/workspaces/")
                ? workspace
                : url.includes("?")
                  ? response
                  : response.data[0],
          ),
      }),
    );

    renderManager({
      resultsSource: { url: "/experiment-results/{experimentId}" },
    });

    fireEvent.click(await screen.findByText("Checkout copy"));
    expect(
      await screen.findByText("Host analytics reports a favourable result"),
    ).toBeDefined();
    expect(screen.getAllByText("52%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("58%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+11.5%").length).toBeGreaterThan(0);
  });
});
