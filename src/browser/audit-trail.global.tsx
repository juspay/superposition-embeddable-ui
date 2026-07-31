import type { FeatureMountOptions, SuperpositionHostAdapters } from "../browser-runtime";
import type { AuditTrailProps } from "../pages/AuditTrail";
import { getBrowserCoreGlobal } from "./global-core";

export const customElementTagName = "superposition-audit-trail";

export function mount(
    container: Element | string,
    options: FeatureMountOptions<AuditTrailProps>,
) {
    return getBrowserCoreGlobal().mountSuperpositionFeature(container, "audit-trail", options);
}

export function defineCustomElement(prefix = "superposition") {
    return getBrowserCoreGlobal().defineFeatureCustomElement("audit-trail", prefix);
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
