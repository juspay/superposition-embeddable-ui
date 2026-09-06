import type { Experiment, ExperimentResults, ExperimentResultsSource } from "../types";
import type { SuperpositionClient } from "./client";

/**
 * Resolves the host-supplied analytics payload for an experiment.
 *
 * Two wiring styles are supported by `SuperpositionExperimentManagerConfig.resultsSource`:
 * - a function that returns the results contract directly, or
 * - a `{ url, transform }` pair pointing at a host endpoint the embed fetches itself.
 *
 * The embed never fabricates values: when no source is configured, or a source
 * returns `null`, the caller renders an empty/no-data state.
 */
export const resolveExperimentResults = async (
  client: SuperpositionClient,
  source: ExperimentResultsSource | undefined,
  experiment: Experiment,
  signal?: AbortSignal,
): Promise<ExperimentResults | null> => {
  if (!source) {
    return null;
  }

  const headers = client.getPublicHeaders();

  if (typeof source === "function") {
    return source({ experiment, headers, signal });
  }

  const url = source.url.replace("{experimentId}", encodeURIComponent(experiment.id));
  const body = await client.getExternal<unknown>(url, { signal });
  return source.transform ? source.transform(body, experiment) : coerceResults(body);
};

/**
 * Best-effort coercion when the host already returns the contract shape and no
 * explicit `transform` was provided. Returns `null` for anything unrecognisable
 * so the UI falls back to its empty state rather than rendering garbage.
 */
const coerceResults = (body: unknown): ExperimentResults | null => {
  if (!body || typeof body !== "object") {
    return null;
  }
  const candidate = body as Partial<ExperimentResults>;
  if (typeof candidate.status !== "string") {
    return null;
  }
  return candidate as ExperimentResults;
};
