import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { resolveTableSerialNumberProps, Table } from "../../src/components/Table";

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

  it("shows empty message when no data", () => {
    render(
      <Table
        columns={columns}
        data={[]}
        keyExtractor={(r: Row) => r.id}
        emptyMessage="Nothing here"
        emptyDescription="Add a row to populate this table."
      />,
    );

    expect(screen.getByText("Nothing here")).toBeDefined();
    expect(screen.getByText("Add a row to populate this table.")).toBeDefined();
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

    expect(screen.getByText("Loading...")).toBeDefined();
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
