import {
  Tooltip as BlendTooltip,
  Button,
  ButtonSize,
  ButtonSubType,
  ButtonType,
  Tag,
  TagColor,
  TagShape,
  TagSize,
  TagVariant,
  TooltipSide,
} from "@juspay/blend-design-system";
import { Download, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../blend-react-compat";
import {
  FormField,
  InlineNotice,
  inputStyle,
  Modal,
  PageHeader,
  resolveTableSearchAlign,
  Table,
} from "../components";
import { useApi, useMutation } from "../hooks/useApi";
import { useAlerts } from "../providers/AlertProvider";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type { CreateDimensionRequest, Dimension } from "../types";
import { normalizeFilterValues, paginateRows } from "../utils";
import { formatErrorMessage } from "../utils/errors";
import { DimensionDetailPage } from "./DimensionDetailPage";
import {
  canUseFeatureAction,
  FeatureUnavailable,
  getMessage,
  isFeatureDetailPageEnabled,
  isFeatureEditable,
  isFeatureEnabled,
} from "./FeatureGate";

export interface DimensionManagerProps {
  pageSize?: number;
  /** Allow create/delete controls for dimensions. Defaults to view-only. */
  editable?: boolean;
  /** Allow clicking a row to open the single dimension detail page. Defaults to enabled. */
  enableDetailPage?: boolean;
}

function filterDimensions(rows: Dimension[], allowedDimensions?: string[]): Dimension[] {
  if (!allowedDimensions || allowedDimensions.length === 0) return rows;
  const allowed = new Set(allowedDimensions);
  return rows.filter((row) => allowed.has(row.dimension));
}

function matchesDimensionSearch(row: Dimension, searchTerm: string): boolean {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return true;

  return [row.dimension, String(row.position), row.description]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.split('"').join('""')}"`;
}

function DimensionManagerContent({
  pageSize = 10,
  editable,
  enableDetailPage,
}: DimensionManagerProps) {
  const { config, dimensions } = useSuperposition();
  const { addAlert, confirmAction } = useAlerts();
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);
  const allowedDimensions = useMemo(
    () => normalizeFilterValues(config.filters?.dimensions),
    [config.filters?.dimensions],
  );
  const shouldClientPage = Boolean(
    (allowedDimensions && allowedDimensions.length > 0) || searchTerm.trim(),
  );
  const isEditable = isFeatureEditable(config, "dimensions", editable);
  const detailPageEnabled = isFeatureDetailPageEnabled(
    config,
    "dimensions",
    enableDetailPage,
  );
  const canCreate = isEditable && canUseFeatureAction(config, "dimensions", "create");
  const canDelete = isEditable && canUseFeatureAction(config, "dimensions", "delete");

  const { data, loading, refetch } = useApi(
    () =>
      dimensions.list(shouldClientPage ? { all: true } : { page, count: rowsPerPage }),
    [dimensions, page, rowsPerPage, shouldClientPage],
  );

  const [newName, setNewName] = useState("");
  const [newPosition, setNewPosition] = useState("0");
  const [newSchema, setNewSchema] = useState('{"type": "string"}');
  const [newDesc, setNewDesc] = useState("");
  const [newReason, setNewReason] = useState("");

  const createMutation = useMutation(
    useCallback(
      async (req: CreateDimensionRequest) => {
        const result = await dimensions.create(req);
        addAlert("success", `Dimension "${result.dimension}" created`);
        return result;
      },
      [dimensions, addAlert],
    ),
  );

  const deleteMutation = useMutation(
    useCallback(
      async (name: string) => {
        await dimensions.delete(name);
        addAlert("success", `Dimension "${name}" deleted`);
      },
      [dimensions, addAlert],
    ),
  );

  const handleCreate = async () => {
    try {
      await createMutation.mutate({
        dimension: newName,
        position: parseInt(newPosition, 10),
        schema: JSON.parse(newSchema),
        description: newDesc || "No description",
        change_reason: newReason || "Created via admin UI",
      });
      setShowCreate(false);
      setNewName("");
      setNewPosition("0");
      setNewSchema('{"type": "string"}');
      setNewDesc("");
      setNewReason("");
      refetch();
    } catch (err) {
      addAlert("error", formatErrorMessage(err, "Could not create dimension."));
    }
  };

  const handleDelete = async (name: string) => {
    const confirmed = await confirmAction({
      title: `Delete dimension "${name}"?`,
      description: "This removes the dimension definition from the workspace.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      await deleteMutation.mutate(name);
      refetch();
    } catch (err) {
      addAlert("error", formatErrorMessage(err, "Could not delete dimension."));
    }
  };

  const filteredRows = filterDimensions(data?.data ?? [], allowedDimensions);
  const searchedRows = useMemo(
    () => filteredRows.filter((row) => matchesDimensionSearch(row, searchTerm)),
    [filteredRows, searchTerm],
  );
  const rows = shouldClientPage
    ? paginateRows(searchedRows, page, rowsPerPage)
    : searchedRows;
  const totalPages = shouldClientPage
    ? Math.max(1, Math.ceil(searchedRows.length / rowsPerPage))
    : (data?.total_pages ?? 0);
  const totalItems = shouldClientPage
    ? searchedRows.length
    : (data?.total_items ?? searchedRows.length);
  const rowsPerPageOptions = Array.from(new Set([pageSize, 10, 20, 50])).sort(
    (left, right) => left - right,
  );
  const searchAlign = resolveTableSearchAlign(config.table, "dimensions");

  useEffect(() => {
    setPage(1);
  }, [searchTerm, rowsPerPage]);

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleExport = useCallback(async () => {
    try {
      const exportData = await dimensions.list({ all: true });
      const exportRows = filterDimensions(
        exportData.data ?? [],
        allowedDimensions,
      ).filter((row) => matchesDimensionSearch(row, searchTerm));
      const csv = [
        ["S.NO", "NAME", "POSITION", "DESCRIPTION"].join(","),
        ...exportRows.map((row, index) =>
          [
            escapeCsv(index + 1),
            escapeCsv(row.dimension),
            escapeCsv(row.position),
            escapeCsv(row.description || ""),
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "dimensions.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      addAlert("error", "Failed to export dimensions");
    }
  }, [addAlert, allowedDimensions, dimensions, searchTerm]);

  const dimensionColumns = [
    {
      key: "dimension",
      header: "Name",
      width: "28%",
      render: (row: Dimension) => (
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--sp-color-text)" }}>
          {row.dimension}
        </div>
      ),
    },
    {
      key: "position",
      header: "Position",
      width: "12%",
      render: (row: Dimension) => (
        <Tag
          text={String(row.position)}
          color={TagColor.PRIMARY}
          variant={TagVariant.SUBTLE}
          size={TagSize.SM}
          shape={TagShape.SQUARICAL}
        />
      ),
    },
    {
      key: "description",
      header: "Description",
      width: canDelete ? "52%" : "60%",
      render: (row: Dimension) => (
        <div
          style={{
            color: row.description ? "var(--sp-color-text)" : "var(--sp-color-muted)",
            fontSize: 14,
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {row.description || "No description"}
        </div>
      ),
    },
    ...(canDelete
      ? [
          {
            key: "actions",
            header: "",
            width: "8%",
            align: "right" as const,
            render: (row: Dimension) => (
              <BlendTooltip
                content={`Delete ${row.dimension}`}
                side={TooltipSide.BOTTOM}
                showArrow
              >
                <Button
                  type="button"
                  aria-label={`Delete dimension ${row.dimension}`}
                  buttonType={ButtonType.DANGER}
                  size={ButtonSize.SMALL}
                  subType={ButtonSubType.ICON_ONLY}
                  leadingIcon={<Trash2 aria-hidden="true" size={14} />}
                  onClick={(event) => {
                    event?.stopPropagation();
                    handleDelete(row.dimension);
                  }}
                />
              </BlendTooltip>
            ),
          },
        ]
      : []),
  ];

  if (detailPageEnabled && selectedDimension) {
    return (
      <DimensionDetailPage
        dimension={selectedDimension}
        backLabel="Back to dimensions"
        onBack={() => setSelectedDimension(null)}
      />
    );
  }

  return (
    <div className="sp-section-stack">
      <PageHeader
        title="Dimensions"
        description="Manage all available dimensions and their metadata."
        actions={
          canCreate ? (
            <Button
              buttonType={ButtonType.PRIMARY}
              size={ButtonSize.MEDIUM}
              text={getMessage(config, "dimensions.create", "Create dimension")}
              leadingIcon={<Plus aria-hidden="true" size={16} />}
              onClick={() => setShowCreate(true)}
            />
          ) : undefined
        }
      />

      <div className="sp-section-stack">
        {createMutation.error ? (
          <InlineNotice
            title="Could not create dimension"
            description={createMutation.error}
            tone="danger"
          />
        ) : null}

        {deleteMutation.error ? (
          <InlineNotice
            title="Could not delete dimension"
            description={deleteMutation.error}
            tone="danger"
          />
        ) : null}

        <Table
          className="sp-table-compact-header sp-table-search-align"
          searchAlign={searchAlign}
          columns={dimensionColumns}
          data={rows}
          keyExtractor={(row) => row.dimension}
          loading={loading}
          showSerialNumber
          serialNumberHeader="S.No"
          serialNumberStart={(page - 1) * rowsPerPage + 1}
          searchPlaceholder="Search dimensions..."
          onSearchChange={(nextSearchTerm) => {
            setSearchTerm(nextSearchTerm);
            setPage(1);
          }}
          pagination={{
            currentPage: page,
            pageSize: rowsPerPage,
            totalRows: totalItems,
            pageSizeOptions: rowsPerPageOptions,
          }}
          onPageChange={setPage}
          onPageSizeChange={(nextRowsPerPage) => {
            setRowsPerPage(nextRowsPerPage);
            setPage(1);
          }}
          onRowClick={
            detailPageEnabled ? (row) => setSelectedDimension(row.dimension) : undefined
          }
          headerSlot2={
            <Button
              type="button"
              buttonType={ButtonType.SECONDARY}
              size={ButtonSize.MEDIUM}
              text="Export"
              leadingIcon={<Download aria-hidden="true" size={17} strokeWidth={2.2} />}
              onClick={handleExport}
            />
          }
          tableBodyHeight="min(668px, 65vh)"
        />
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Dimension"
        footer={
          <>
            <Button
              buttonType={ButtonType.SECONDARY}
              size={ButtonSize.MEDIUM}
              text="Cancel"
              onClick={() => setShowCreate(false)}
            />
            <Button
              buttonType={ButtonType.PRIMARY}
              size={ButtonSize.MEDIUM}
              text={createMutation.loading ? "Creating..." : "Create"}
              onClick={handleCreate}
              disabled={!canCreate || createMutation.loading || !newName}
              loading={createMutation.loading}
            />
          </>
        }
      >
        <FormField label="Name" required>
          <input
            style={inputStyle}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="dimension_name"
          />
        </FormField>
        <FormField label="Position" required>
          <input
            style={inputStyle}
            type="number"
            value={newPosition}
            onChange={(e) => setNewPosition(e.target.value)}
            min={0}
          />
        </FormField>
        <FormField label="Schema (JSON)" required>
          <textarea
            style={{ ...inputStyle, fontFamily: "monospace", minHeight: 60 }}
            value={newSchema}
            onChange={(e) => setNewSchema(e.target.value)}
          />
        </FormField>
        <FormField label="Description">
          <input
            style={inputStyle}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
        </FormField>
        <FormField label="Change Reason" required>
          <input
            style={inputStyle}
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Reason for this change"
          />
        </FormField>
      </Modal>
    </div>
  );
}

export function DimensionManager(props: DimensionManagerProps) {
  const { config } = useSuperposition();

  if (!isFeatureEnabled(config.features, "dimensions")) {
    return (
      <FeatureUnavailable
        feature="Dimensions"
        message={getMessage(
          config,
          "feature.disabled",
          "{feature} is not enabled for this embed.",
          { feature: "Dimensions" },
        )}
      />
    );
  }

  return <DimensionManagerContent {...props} />;
}
