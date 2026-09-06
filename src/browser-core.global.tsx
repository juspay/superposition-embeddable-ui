import "./blend-react-compat";

import type { ComponentType } from "react";
import {
  createTagName,
  defineSingleCustomElement,
  mountFeatureComponent,
  registerSuperpositionHostAdapters,
  unregisterSuperpositionHostAdapters,
  type FeatureName,
} from "./browser-runtime";
import { AuditTrail } from "./pages/AuditTrail";
import { ConfigManager } from "./pages/ConfigManager";
import { DimensionManager } from "./pages/DimensionManager";
import { ExperimentManager } from "./pages/ExperimentManager";
import { OverrideManager } from "./pages/OverrideManager";
import { SuperpositionAdmin } from "./pages/SuperpositionAdmin";
import type { SuperpositionEmbeddableConfig } from "./types";

type FeatureComponentProps = object;

const featureComponents = {
  admin: SuperpositionAdmin,
  "config-manager": ConfigManager,
  "override-manager": OverrideManager,
  "dimension-manager": DimensionManager,
  "audit-trail": AuditTrail,
  "experiment-manager": ExperimentManager,
} satisfies Record<FeatureName, ComponentType<never>>;

export const customElementTagNames = Object.fromEntries(
  (Object.keys(featureComponents) as FeatureName[]).map((feature) => [
    feature,
    createTagName("superposition", feature),
  ]),
) as Record<FeatureName, string>;

export function mountSuperpositionFeature(
  container: Element | string,
  feature: FeatureName,
  options: { config: SuperpositionEmbeddableConfig; props?: FeatureComponentProps },
) {
  return mountFeatureComponent(
    container,
    featureComponents[feature] as ComponentType<FeatureComponentProps>,
    options,
  );
}

export function defineFeatureCustomElement(
  feature: FeatureName,
  prefix = "superposition",
) {
  const tagName = createTagName(prefix, feature);
  return defineSingleCustomElement(
    tagName,
    featureComponents[feature] as ComponentType<FeatureComponentProps>,
  );
}

export function defineCustomElements(prefix = "superposition") {
  const tagMap = Object.fromEntries(
    (Object.keys(featureComponents) as FeatureName[]).map((feature) => [
      feature,
      defineFeatureCustomElement(feature, prefix),
    ]),
  ) as Record<FeatureName, string>;

  return tagMap;
}

export { registerSuperpositionHostAdapters, unregisterSuperpositionHostAdapters };
