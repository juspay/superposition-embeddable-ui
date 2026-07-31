import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip } from "../../src/components/Tooltip";

describe("Tooltip", () => {
    it("applies aria-describedby to the interactive child", () => {
        render(
            <Tooltip content="Helpful details">
                <button type="button" aria-describedby="existing-description">
                    Hover me
                </button>
            </Tooltip>,
        );

        const trigger = screen.getByRole("button", { name: "Hover me" });
        const tooltip = screen.getByRole("tooltip", { name: "Helpful details" });

        expect(trigger.getAttribute("aria-describedby")).toContain("existing-description");
        expect(trigger.getAttribute("aria-describedby")).toContain(tooltip.id);
        expect(trigger.parentElement?.getAttribute("aria-describedby")).toBeNull();
    });
});
