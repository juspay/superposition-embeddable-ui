import type { Dimension } from "../types";

type DimensionTypeValue = Dimension["dimension_type"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function formatDimensionType(dimensionType: DimensionTypeValue): string {
  if (typeof dimensionType === "string") {
    return dimensionType;
  }

  if (isRecord(dimensionType) && "REGULAR" in dimensionType) {
    return "REGULAR";
  }

  if (isRecord(dimensionType) && "LOCAL_COHORT" in dimensionType) {
    return `LOCAL_COHORT:${dimensionType.LOCAL_COHORT}`;
  }

  if (isRecord(dimensionType) && "REMOTE_COHORT" in dimensionType) {
    return `REMOTE_COHORT:${dimensionType.REMOTE_COHORT}`;
  }

  return JSON.stringify(dimensionType);
}

export function getCohortBaseDimension(dimensionType: DimensionTypeValue): string | null {
  if (typeof dimensionType === "string") return null;
  if (!isRecord(dimensionType)) return null;

  if ("LOCAL_COHORT" in dimensionType) {
    return String(dimensionType.LOCAL_COHORT);
  }

  if ("REMOTE_COHORT" in dimensionType) {
    return String(dimensionType.REMOTE_COHORT);
  }

  return null;
}

export function isLocalCohortDimension(dimensionType: DimensionTypeValue): boolean {
  return isRecord(dimensionType) && "LOCAL_COHORT" in dimensionType;
}
