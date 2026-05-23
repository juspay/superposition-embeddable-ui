import { Tabs, TabsSize, TabsVariant, TagColor } from "@juspay/blend-design-system";
import React, { useState } from "react";
import "../blend-react-compat";
import { BoundaryFilterControl, EmptyState, MetaTag } from "../components";
import { AlertProvider } from "../providers/AlertProvider";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import {
  SUPERPOSITION_FEATURE_LABELS,
  SUPERPOSITION_FEATURES,
  type SuperpositionFeature,
} from "../types";
import { AuditTrail } from "./AuditTrail";
import { ConfigManager } from "./ConfigManager";
import { DimensionManager } from "./DimensionManager";
import { getMessage, isFeatureEditable } from "./FeatureGate";
import { OverrideManager } from "./OverrideManager";

type Tab = SuperpositionFeature;

const allTabs: { id: Tab; label: string }[] = SUPERPOSITION_FEATURES.map((id) => ({
  id,
  label: SUPERPOSITION_FEATURE_LABELS[id],
}));

const tabComponents: Record<Tab, React.FC> = {
  config: ConfigManager,
  overrides: OverrideManager,
  dimensions: DimensionManager,
  audit: AuditTrail,
};

export interface SuperpositionAdminProps {
  defaultFeature?: Tab;
  defaultTab?: Tab;
  allowConfigEditing?: boolean;
  allowDimensionEditing?: boolean;
}

export function SuperpositionAdmin({
  defaultFeature,
  defaultTab = "config",
  allowConfigEditing,
  allowDimensionEditing,
}: SuperpositionAdminProps) {
  const { config } = useSuperposition();
  const features = config.features;
  const routing = "routing" in config ? config.routing : undefined;
  const showBoundaryFilter = config.ui?.showBoundaryFilter ?? !config.strict;

  const visibleTabs = features ? allTabs.filter((t) => features.includes(t.id)) : allTabs;

  const initialTab = routing?.initialFeature ?? defaultFeature ?? defaultTab;

  const [activeTab, setActiveTab] = useState<Tab>(
    visibleTabs.find((t) => t.id === initialTab)?.id ?? visibleTabs[0]?.id ?? "config",
  );

  const selectedTab =
    routing?.mode === "external"
      ? (visibleTabs.find((t) => t.id === routing.currentFeature)?.id ??
        visibleTabs[0]?.id ??
        activeTab)
      : (visibleTabs.find((t) => t.id === activeTab)?.id ??
        visibleTabs[0]?.id ??
        activeTab);

  const handleTabChange = (tab: Tab) => {
    if (routing?.mode !== "external") {
      setActiveTab(tab);
    }

    routing?.onNavigate?.(tab);
  };

  const renderFeature = (tab: Tab) => {
    if (tab === "config") {
      return (
        <ConfigManager
          editable={isFeatureEditable(config, "config", allowConfigEditing)}
        />
      );
    }

    if (tab === "dimensions") {
      return (
        <DimensionManager
          editable={isFeatureEditable(config, "dimensions", allowDimensionEditing)}
        />
      );
    }

    const Component = tabComponents[tab];
    return <Component />;
  };

  if (visibleTabs.length === 0) {
    return (
      <AlertProvider>
        <EmptyState
          title={getMessage(
            config,
            "admin.noFeatures",
            "No Superposition features are enabled for this embed.",
          )}
        />
      </AlertProvider>
    );
  }

  return (
    <AlertProvider>
      <div className="sp-admin-shell">
        <div className="sp-section-stack">
          <div className="sp-admin-topbar">
            {showBoundaryFilter ? <BoundaryFilterControl /> : null}
            <div className="sp-admin-meta">
              <MetaTag text={`Org ${config.orgId}`} color={TagColor.NEUTRAL} />
              <MetaTag text={`Workspace ${config.workspace}`} color={TagColor.PRIMARY} />
            </div>
          </div>

          {routing?.mode === "external" ? (
            <>
              <nav className="sp-admin-tabs" aria-label="Superposition features">
                {visibleTabs.map((tab) =>
                  (() => {
                    const isActive = selectedTab === tab.id;
                    const href = routing?.getFeatureHref?.(tab.id);

                    return (
                      <a
                        key={tab.id}
                        href={href}
                        aria-current={isActive ? "page" : undefined}
                        className={
                          isActive ? "sp-admin-tab sp-admin-tab--active" : "sp-admin-tab"
                        }
                        onClick={(event) => {
                          event.preventDefault();
                          handleTabChange(tab.id);
                        }}
                      >
                        {tab.label}
                      </a>
                    );
                  })(),
                )}
              </nav>
              <div className="sp-admin-content">{renderFeature(selectedTab)}</div>
            </>
          ) : (
            <Tabs
              value={selectedTab}
              onValueChange={(value) => handleTabChange(value as Tab)}
              variant={TabsVariant.UNDERLINE}
              size={TabsSize.MD}
              showDropdown
              items={visibleTabs.map((tab) => ({
                value: tab.id,
                label: tab.label,
                content: <div className="sp-admin-content">{renderFeature(tab.id)}</div>,
              }))}
            />
          )}
        </div>
      </div>
    </AlertProvider>
  );
}
