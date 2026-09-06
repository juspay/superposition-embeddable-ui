import type { FeatureMountOptions, SuperpositionHostAdapters } from "../browser-runtime";
import type { ExperimentManagerProps } from "../pages/ExperimentManager";
import { getBrowserCoreGlobal } from "./global-core";

export const customElementTagName = "superposition-experiment-manager";

export function mount(
  container: Element | string,
  options: FeatureMountOptions<ExperimentManagerProps>,
) {
  return getBrowserCoreGlobal().mountSuperpositionFeature(
    container,
    "experiment-manager",
    options,
  );
}

export function defineCustomElement(prefix = "superposition") {
  return getBrowserCoreGlobal().defineFeatureCustomElement("experiment-manager", prefix);
}

export function registerSuperpositionHostAdapters(
  id: string,
  adapters: SuperpositionHostAdapters,
) {
  return getBrowserCoreGlobal().registerSuperpositionHostAdapters(id, adapters);
}

export function unregisterSuperpositionHostAdapters(id: string) {
  return getBrowserCoreGlobal().unregisterSuperpositionHostAdapters(id);
}
