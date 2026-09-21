import { describe, expect, it } from "vitest";
import { SuperpositionApiError } from "../../src/api/client";
import { formatErrorMessage } from "../../src/utils/errors";

describe("formatErrorMessage", () => {
  it("renders only an approved backend error message", () => {
    const error = new SuperpositionApiError(
      400,
      JSON.stringify({
        error: {
          type: "invalid_request",
          message:
            "At least one dimension filter (organization_id, provider_merchant_id, processor_merchant_id, merchant_id, or profile_id) is required",
          code: "IR_06",
        },
      }),
      "/context",
    );

    expect(formatErrorMessage(error)).toBe(
      "At least one dimension filter (organization_id, provider_merchant_id, processor_merchant_id, merchant_id, or profile_id) is required",
    );
    expect(formatErrorMessage(error)).not.toContain("invalid_request");
    expect(formatErrorMessage(error)).not.toContain("IR_06");
  });

  it("supports approved top-level backend message fields", () => {
    const error = new SuperpositionApiError(
      422,
      JSON.stringify({ message: "Config key is required", code: "IR_07" }),
      "/default-config",
    );

    expect(formatErrorMessage(error)).toBe("Config key is required");
  });

  it("does not expose non-JSON API responses", () => {
    const error = new SuperpositionApiError(
      403,
      "<html><body>Access denied by upstream</body></html>",
      "/context",
    );

    expect(formatErrorMessage(error, "Unable to load configs. Please try again.")).toBe(
      "Unable to load configs. Please try again.",
    );
  });
});
