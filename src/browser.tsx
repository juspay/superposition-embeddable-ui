import "./blend-react-compat";

import type { ComponentType } from "react";
import React from "react";
import {
  createTagName,
  defineSingleCustomElement,
  mountFeatureComponent,
  registerSuperpositionHostAdapters,
  unregisterSuperpositionHostAdapters,
  type FeatureName,
  type SuperpositionHostAdapters,
} from "./browser-runtime";
import type { SuperpositionEmbeddableConfig } from "./types";

type FeatureComponentProps = Record<string, unknown>;
type LazyFeature = React.LazyExoticComponent<ComponentType<FeatureComponentProps>>;

const featureComponents: Record<FeatureName, LazyFeature> = {
  admin: React.lazy(async () => {
    const mod = await import("./pages/SuperpositionAdmin");
    return {
      default: mod.SuperpositionAdmin as React.ComponentType<FeatureComponentProps>,
    };
  }),
  "config-manager": React.lazy(async () => {
    const mod = await import("./pages/ConfigManager");
    return { default: mod.ConfigManager as React.ComponentType<FeatureComponentProps> };
  }),
  "override-manager": React.lazy(async () => {
    const mod = await import("./pages/OverrideManager");
    return { default: mod.OverrideManager as React.ComponentType<FeatureComponentProps> };
  }),
  "dimension-manager": React.lazy(async () => {
    const mod = await import("./pages/DimensionManager");
    return {
      default: mod.DimensionManager as React.ComponentType<FeatureComponentProps>,
    };
  }),
  "experiment-manager": React.lazy(async () => {
    const mod = await import("./pages/ExperimentManager");
    return {
      default: mod.ExperimentManager as React.ComponentType<FeatureComponentProps>,
    };
  }),
  "audit-trail": React.lazy(async () => {
    const mod = await import("./pages/AuditTrail");
    return { default: mod.AuditTrail as React.ComponentType<FeatureComponentProps> };
  }),
};

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
): { unmount: () => void } {
  return mountFeatureComponent(container, featureComponents[feature], options);
}

export function defineCustomElements(prefix = "superposition") {
  const tagMap = Object.fromEntries(
    (Object.keys(featureComponents) as FeatureName[]).map((feature) => [
      feature,
      createTagName(prefix, feature),
    ]),
  ) as Record<FeatureName, string>;

  (Object.keys(tagMap) as FeatureName[]).forEach((feature) => {
    const tagName = tagMap[feature];
    defineSingleCustomElement(tagName, featureComponents[feature]);
  });

  return tagMap;
}

export { registerSuperpositionHostAdapters, unregisterSuperpositionHostAdapters };
export type { SuperpositionHostAdapters };
