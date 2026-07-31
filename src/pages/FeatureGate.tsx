import { EmptyState } from "../components";
import type {
  SuperpositionEmbeddableConfig,
  SuperpositionFeature,
  SuperpositionFeatureCapabilities,
} from "../types";

export function isFeatureEnabled(
  features: SuperpositionFeature[] | undefined,
  feature: SuperpositionFeature,
): boolean {
  return !features || features.includes(feature);
}

export function canUseFeatureAction(
  config: SuperpositionEmbeddableConfig,
  feature: SuperpositionFeature,
  action: keyof SuperpositionFeatureCapabilities,
): boolean {
  if (config.readOnly) {
    return false;
  }

  return config.capabilities?.[feature]?.[action] ?? false;
}

export function isFeatureEditable(
  config: SuperpositionEmbeddableConfig,
  feature: SuperpositionFeature,
  editable?: boolean,
): boolean {
  return editable ?? config.ui?.featureControls?.[feature]?.editable ?? false;
}

export function isFeatureDetailPageEnabled(
  config: SuperpositionEmbeddableConfig,
  feature: SuperpositionFeature,
  enabled?: boolean,
): boolean {
  return enabled ?? config.ui?.featureControls?.[feature]?.detailPage ?? true;
}

export function getMessage(
  config: SuperpositionEmbeddableConfig,
  key: string,
  fallback: string,
  values?: Record<string, string | number>,
): string {
  const template = config.messages?.[key] ?? fallback;
  if (!values) return template;

  return Object.entries(values).reduce(
    (result, [name, value]) => result.split(`{${name}}`).join(String(value)),
    template,
  );
}

export function FeatureUnavailable({
  feature,
  message,
}: {
  feature: string;
  message?: string;
}) {
  return <EmptyState title={message ?? `${feature} is not enabled for this embed.`} />;
}
