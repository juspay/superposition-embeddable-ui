import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { resolveTableSerialNumberProps, Table } from "../../src/components/Table";
import { SuperpositionUIProvider } from "../../src/providers/SuperpositionUIProvider";

interface Row {
  id: string;
  name: string;
  age: number;
}

const columns = [
  { key: "name", header: "Name" },
  { key: "age", header: "Age", render: (row: Row) => `${row.age} years` },
];

const data: Row[] = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
];

describe("Table", () => {
  it("renders headers and data", () => {
    render(<Table columns={columns} data={data} keyExtractor={(r) => r.id} />);

    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Age")).toBeDefined();
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("30 years")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
    expect(screen.getByText("25 years")).toBeDefined();
  });

  it("renders with empty data", () => {
    expect(() =>
      render(<Table columns={columns} data={[]} keyExtractor={(r: Row) => r.id} />),
    ).not.toThrow();
  });

  it("shows loading state", () => {
    render(
      <Table
        columns={columns}
        data={[]}
        keyExtractor={(r: Row) => r.id}
        loading={true}
      />,
    );

    expect(screen.getByText("Loading data...")).toBeDefined();
  });

  it("calls onRowClick when row is clicked", () => {
    const onClick = vi.fn();
    render(
      <Table
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        onRowClick={onClick}
      />,
    );

    fireEvent.click(screen.getByText("Alice"));
    expect(onClick).toHaveBeenCalledWith(data[0]);
  });

  it("renders a serial number column when enabled", () => {
    render(
      <Table
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        showSerialNumber
        serialNumberHeader="S.No"
        serialNumberStart={11}
      />,
    );

    expect(screen.getByText("S.No")).toBeDefined();
    expect(screen.getByText("11")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("11").style.textAlign).toBe("left");
  });

  it("keeps Blend table controls from submitting host forms", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    const onPageSizeChange = vi.fn();

    render(
      <form onSubmit={onSubmit}>
        <SuperpositionUIProvider
          config={{ apiBaseUrl: "/api", orgId: "org", workspace: "ws" }}
        >
          <Table
            columns={columns}
            data={data}
            keyExtractor={(row) => row.id}
            pagination={{
              currentPage: 1,
              pageSize: 10,
              totalRows: 25,
              pageSizeOptions: [10, 20],
            }}
            onPageChange={vi.fn()}
            onPageSizeChange={onPageSizeChange}
            enableColumnManager
            columnManagerAlwaysSelected={["name"]}
          />
        </SuperpositionUIProvider>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Manage columns" }));
    await user.click(
      screen.getByRole("button", { name: "Select number of rows per page" }),
    );
    await user.click(await screen.findByText("20"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onPageSizeChange).toHaveBeenCalledWith(20);
  });

  it("keeps rows-per-page warning-free on narrow screens", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    const onPageSizeChange = vi.fn();
    const originalInnerWidth = window.innerWidth;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 500,
    });
    window.dispatchEvent(new Event("resize"));

    try {
      render(
        <form onSubmit={onSubmit}>
          <SuperpositionUIProvider
            config={{ apiBaseUrl: "/api", orgId: "org", workspace: "ws" }}
          >
            <Table
              columns={columns}
              data={data}
              keyExtractor={(row) => row.id}
              pagination={{
                currentPage: 1,
                pageSize: 10,
                totalRows: 25,
                pageSizeOptions: [10, 20],
              }}
              onPageChange={vi.fn()}
              onPageSizeChange={onPageSizeChange}
            />
          </SuperpositionUIProvider>
        </form>,
      );

      await user.click(
        screen.getByRole("button", { name: "Select number of rows per page" }),
      );
      await user.click(await screen.findByText("20 / page"));

      const consoleMessages = consoleErrorSpy.mock.calls
        .flat()
        .map((message) => String(message));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(onPageSizeChange).toHaveBeenCalledWith(20);
      expect(
        consoleMessages.some(
          (message) =>
            message.includes("Function components cannot be given refs") ||
            message.includes("enableVirtualization"),
        ),
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: originalInnerWidth,
      });
      window.dispatchEvent(new Event("resize"));
    }
  });

  it("resolves serial number options from embeddable config", () => {
    expect(resolveTableSerialNumberProps({ serialNumber: true }, 21)).toEqual({
      showSerialNumber: true,
      serialNumberStart: 21,
    });

    expect(
      resolveTableSerialNumberProps({
        serialNumber: {
          header: "No.",
          startAt: 5,
          width: "72px",
          align: "right",
        },
      }),
    ).toEqual({
      showSerialNumber: true,
      serialNumberHeader: "No.",
      serialNumberStart: 5,
      serialNumberWidth: "72px",
      serialNumberAlign: "right",
    });
  });
});
