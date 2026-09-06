import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Fragment, jsx, jsxs } from "../../src/browser/react-jsx-runtime";

function Panel({ title, children }: { title: string; children?: ReactNode }) {
  return jsxs("section", { children: [jsx("h2", { children: title }), children] });
}

describe("browser JSX runtime shim", () => {
  it("renders host elements with props and children", () => {
    render(jsx("p", { title: "hint", children: "Hello" }));

    const paragraph = screen.getByText("Hello");
    expect(paragraph.tagName).toBe("P");
    expect(paragraph.getAttribute("title")).toBe("hint");
  });

  it("keeps keys off props and on the element", () => {
    const element = jsx("li", { children: "first" }, "row-1");

    expect(element.key).toBe("row-1");
    expect(element.props).toEqual({ children: "first" });
  });

  it("renders components, multiple children and fragments", () => {
    render(
      jsx(Panel, {
        title: "Results",
        children: jsxs(Fragment, {
          children: [
            jsx("span", { children: "one" }, "1"),
            jsx("span", { children: "two" }, "2"),
          ],
        }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Results" })).toBeDefined();
    expect(screen.getByText("one")).toBeDefined();
    expect(screen.getByText("two")).toBeDefined();
  });
});
