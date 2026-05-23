import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditTrail } from "../../src/pages/AuditTrail";
import { AlertProvider } from "../../src/providers/AlertProvider";
import { SuperpositionUIProvider } from "../../src/providers/SuperpositionUIProvider";

const testConfig = {
    apiBaseUrl: "https://test.com",
    orgId: "org",
    workspace: "ws",
};

const mockAuditLogs = {
    total_pages: 1,
    total_items: 2,
    data: [
        {
            id: "audit-1",
            table_name: "contexts",
            user_name: "alice",
            timestamp: "2024-01-01T08:30:00.000Z",
            action: "UPDATE",
            original_data: { value: { region: "us", env: "prod" }, override: { "app.title": "Old title" } },
            new_data: { value: { region: "us", env: "prod" }, override: { "app.title": "New title" } },
            query: "UPDATE contexts SET override = '{\"app.title\":\"New title\"}'",
        },
        {
            id: "audit-2",
            table_name: "default_configs",
            user_name: "bob",
            timestamp: "2024-01-02T10:45:00.000Z",
            action: "INSERT",
            original_data: null,
            new_data: { value: { region: "eu", env: "prod" }, key: "feature.enabled", enabled: true },
            query: "INSERT INTO default_configs (key, value) VALUES ('feature.enabled', true)",
        },
    ],
};

describe("AuditTrail", () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", mockFetch);
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ "content-length": "500" }),
            json: () => Promise.resolve(mockAuditLogs),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders audit events and expands inline diff details", async () => {
        render(
            <SuperpositionUIProvider config={testConfig}>
                <AlertProvider>
                    <AuditTrail />
                </AlertProvider>
            </SuperpositionUIProvider>,
        );

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "Audit Trail" })).toBeDefined();
            expect(screen.getByText("Track inserts, updates, deletes, and compare changes across configuration tables.")).toBeDefined();
            expect(screen.getAllByText("contexts").length).toBeGreaterThan(0);
            expect(screen.getAllByText("View").length).toBeGreaterThan(0);
        });

        expect(screen.queryByText("Audit log entries")).toBeNull();
        expect(screen.queryByPlaceholderText("Filter by username")).toBeNull();
        expect(screen.queryByText("alice")).toBeNull();
        expect(screen.getByLabelText("Filter by table")).toBeDefined();
        expect(screen.getByLabelText("Filter by action")).toBeDefined();
        expect(screen.getByText("INSERT").style.background).toBe("rgb(236, 253, 243)");
        expect(screen.getByText("UPDATE").style.background).toBe("rgb(239, 246, 255)");
        fireEvent.click(screen.getByRole("button", { name: /All actions/i }));
        expect(screen.getByRole("option", { name: "DELETE" })).toBeDefined();
        fireEvent.click(screen.getByRole("button", { name: /Date range/i }));
        expect(screen.getByRole("dialog", { name: "Date range filter" })).toBeDefined();
        expect(screen.getByText("Showing 1 to 2 of 2 records")).toBeDefined();
        fireEvent.click(screen.getByRole("button", { name: "Expand audit row audit-1" }));

        await waitFor(() => {
            expect(screen.getByText("Changes")).toBeDefined();
            expect(screen.getAllByText("Original Data").length).toBeGreaterThan(0);
            expect(screen.getAllByText("New Data").length).toBeGreaterThan(0);
            expect(screen.getByText(/Old title/)).toBeDefined();
            expect(screen.getByText(/New title/)).toBeDefined();
        });

        fireEvent.click(screen.getAllByRole("button", { name: "View new" })[0]);

        await waitFor(() => {
            const dialog = screen.getByRole("dialog", { name: "New Data" });
            expect(dialog).toBeDefined();
            expect(within(dialog).getByText(/New title/)).toBeDefined();
        });

        expect(screen.queryByText(/UPDATE contexts SET override/i)).toBeNull();
        expect(screen.queryByRole("columnheader", { name: "Actions" })).toBeNull();
        expect(screen.queryByText("Compare")).toBeNull();
    });

    it("uses host scope as the only filter surface", async () => {
        render(
            <SuperpositionUIProvider
                config={{
                    ...testConfig,
                    scope: { context: { region: "us" } },
                }}
            >
                <AlertProvider>
                    <AuditTrail pageSize={1} />
                </AlertProvider>
            </SuperpositionUIProvider>,
        );

        await waitFor(() => {
            expect(screen.getAllByText("contexts").length).toBeGreaterThan(0);
        });

        expect(screen.queryByText("Host scope")).toBeNull();
        expect(screen.queryByPlaceholderText("Filter by username")).toBeNull();
        expect(screen.queryByText("alice")).toBeNull();
        expect(screen.queryByText("bob")).toBeNull();
        expect(screen.queryByText(/Page 1 of 1/i)).toBeNull();
        expect(mockFetch).toHaveBeenCalledWith(
            "https://test.com/audit?all=true&sort_by=desc",
            expect.objectContaining({ method: "GET" }),
        );
    });
});
