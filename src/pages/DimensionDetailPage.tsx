import { TagColor } from "@juspay/blend-design-system";
import type React from "react";
import "../blend-react-compat";
import {
  CopyableJsonField,
  InlineNotice,
  MetaTag,
  ReadonlyValueField,
  RecordDetailHeader,
  RecordMetadataSummary,
  Surface,
} from "../components";
import { useApi } from "../hooks/useApi";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type { Dimension } from "../types";
import {
  formatDimensionType,
  getCohortBaseDimension,
  isLocalCohortDimension,
} from "../utils/dimensions";
import { FeatureUnavailable, getMessage, isFeatureEnabled } from "./FeatureGate";

export interface DimensionDetailPageProps {
  /** Dimension name to display. */
  dimension: string;
  /** Called when the user clicks Back. If omitted, no back action is rendered. */
  onBack?: () => void;
  backLabel?: string;
}

type DependencyGraphRecord = Record<string, string[]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeDependencyGraph(
  graph: Dimension["dependency_graph"],
): DependencyGraphRecord {
  if (!isRecord(graph)) return {};

  return Object.fromEntries(
    Object.entries(graph).map(([name, children]) => [
      name,
      Array.isArray(children) ? children.map(String) : [],
    ]),
  );
}

function formatTimestamp(value: unknown): string {
  if (!value) return "Not provided";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString();
}

function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Surface>
      <div className="sp-detail-section">
        <div className="sp-detail-section__header">
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {children}
      </div>
    </Surface>
  );
}

function FunctionDetail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="sp-detail-function-row">
      <span>{label}</span>
      {value ? (
        <MetaTag text={value} color={TagColor.PRIMARY} />
      ) : (
        <span>Not provided</span>
      )}
    </div>
  );
}

function BooleanTag({ value }: { value: boolean }) {
  return (
    <MetaTag
      text={value ? "Yes" : "No"}
      color={value ? TagColor.SUCCESS : TagColor.NEUTRAL}
    />
  );
}

function DependencyNode({
  name,
  graph,
  root = false,
  visited = new Set<string>(),
}: {
  name: string;
  graph: DependencyGraphRecord;
  root?: boolean;
  visited?: Set<string>;
}) {
  const children = graph[name] ?? [];
  const nextVisited = new Set(visited);
  nextVisited.add(name);

  return (
    <li>
      <div className="sp-dependency-node">
        <MetaTag
          text={root ? `${name} (current)` : name}
          color={root ? TagColor.PRIMARY : TagColor.NEUTRAL}
        />
        {children.length > 0 ? <span>depends on</span> : null}
      </div>
      {children.length > 0 ? (
        <ul>
          {children.map((child) =>
            nextVisited.has(child) ? (
              <li key={child}>
                <div className="sp-dependency-node">
                  <MetaTag text={`${child} (cycle)`} color={TagColor.WARNING} />
                </div>
              </li>
            ) : (
              <DependencyNode
                key={child}
                name={child}
                graph={graph}
                visited={nextVisited}
              />
            ),
          )}
        </ul>
      ) : null}
    </li>
  );
}

function DependencyGraphView({ dimension }: { dimension: Dimension }) {
  const graph = normalizeDependencyGraph(dimension.dependency_graph);
  const cohortBase = getCohortBaseDimension(dimension.dimension_type);
  const hasGraph =
    Object.keys(graph).length > 0 && (graph[dimension.dimension] ?? []).length > 0;

  if (!hasGraph && !cohortBase) {
    return <p className="sp-detail-muted">No dependency data for this dimension.</p>;
  }

  return (
    <div className="sp-detail-dependency-layout">
      {hasGraph ? (
        <div>
          <span className="sp-detail-mini-label">
            Dimensions on which this dimension depends
          </span>
          <ul className="sp-dependency-tree">
            <DependencyNode name={dimension.dimension} graph={graph} root />
          </ul>
        </div>
      ) : null}
      {cohortBase ? (
        <div>
          <span className="sp-detail-mini-label">Cohort is based on</span>
          <div className="sp-detail-tag-row">
            <MetaTag text={cohortBase} color={TagColor.PRIMARY} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DimensionDetailContent({
  dimension,
  onBack,
  backLabel = "Back",
}: DimensionDetailPageProps) {
  const { dimensions } = useSuperposition();
  const { data, loading, error } = useApi(
    () => dimensions.get(dimension),
    [dimensions, dimension],
  );

  const schemaTitle =
    data && isLocalCohortDimension(data.dimension_type) ? "Cohort Schema" : "Schema";
  const hasFunctions = Boolean(
    data?.value_validation_function_name || data?.value_compute_function_name,
  );

  return (
    <div className="sp-detail-page sp-record-detail-page sp-dimension-detail-page">
      <RecordDetailHeader
        title={dimension}
        description="Dimension detail, schema, functions, dependency data, and metadata."
        onBack={onBack}
        backLabel={backLabel}
      />

      {error ? (
        <InlineNotice
          title="Could not load dimension"
          description={error}
          tone="danger"
        />
      ) : null}

      {loading && !data ? (
        <Surface>
          <p className="sp-detail-muted">Loading dimension...</p>
        </Surface>
      ) : null}

      {data ? (
        <>
          <RecordMetadataSummary
            description={data.description}
            changeReason={data.change_reason}
            createdBy={data.created_by}
            createdAt={formatTimestamp(data.created_at)}
            lastModifiedBy={data.last_modified_by}
            lastModifiedAt={formatTimestamp(data.last_modified_at)}
          />

          <DetailSection title="Info">
            <div className="sp-record-detail-info">
              <div className="sp-record-detail-info-row">
                <span>Position</span>
                <ReadonlyValueField value={String(data.position)} />
              </div>
              <div className="sp-record-detail-info-row">
                <span>Dimension Type</span>
                <ReadonlyValueField value={formatDimensionType(data.dimension_type)} />
              </div>
              <div className="sp-record-detail-info-row">
                <span>Mandatory</span>
                <div className="sp-record-detail-readonly-field">
                  <BooleanTag value={data.mandatory} />
                </div>
              </div>
              <div className="sp-record-detail-info-row">
                <span>{schemaTitle}</span>
                <CopyableJsonField data={data.schema} label={schemaTitle.toLowerCase()} />
              </div>
              {hasFunctions ? (
                <div className="sp-record-detail-info-row">
                  <span>Functions</span>
                  <div className="sp-detail-function-grid">
                    <FunctionDetail
                      label="Validation Function"
                      value={data.value_validation_function_name}
                    />
                    <FunctionDetail
                      label="Value Compute Function"
                      value={data.value_compute_function_name}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </DetailSection>

          <DetailSection title="Dependency Data">
            <DependencyGraphView dimension={data} />
          </DetailSection>
        </>
      ) : null}
    </div>
  );
}

export function DimensionDetailPage(props: DimensionDetailPageProps) {
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

  return <DimensionDetailContent {...props} />;
}
