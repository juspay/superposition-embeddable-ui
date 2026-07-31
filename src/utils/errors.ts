import { SuperpositionApiError } from "../api/client";

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractBackendMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;

  const nestedError = value.error;
  if (isRecord(nestedError)) {
    const nestedMessage = normalizeMessage(nestedError.message);
    if (nestedMessage) return nestedMessage;
  }

  return normalizeMessage(value.message);
}

function parseBackendMessage(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  try {
    return extractBackendMessage(JSON.parse(trimmed));
  } catch {
    const jsonStart = trimmed.indexOf("{");
    if (jsonStart < 0) return undefined;

    try {
      return extractBackendMessage(JSON.parse(trimmed.slice(jsonStart)));
    } catch {
      return undefined;
    }
  }
}

function getDisplayMessage(error: unknown): string | undefined {
  if (error instanceof SuperpositionApiError) {
    return parseBackendMessage(error.body) ?? normalizeMessage(error.body);
  }

  const structuredMessage = extractBackendMessage(error);
  if (structuredMessage) return structuredMessage;

  if (error instanceof Error) {
    return parseBackendMessage(error.message) ?? normalizeMessage(error.message);
  }

  if (typeof error === "string") {
    return parseBackendMessage(error) ?? normalizeMessage(error);
  }

  return undefined;
}

export function formatErrorMessage(
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE,
): string {
  return getDisplayMessage(error) ?? fallback;
}
