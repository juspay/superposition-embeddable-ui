import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FOUNDATION_THEME,
  Theme as BlendTheme,
  ThemeProvider as BlendThemeProvider,
  type ComponentTokenType as BlendComponentTokenType,
  type ThemeType as BlendThemeType,
} from "@juspay/blend-design-system";
import { SuperpositionClient } from "../api/client";
import { defaultConfigsApi } from "../api/default-configs";
import { dimensionsApi } from "../api/dimensions";
import { overridesApi } from "../api/overrides";
import { resolveApi } from "../api/resolve";
import type {
  JsonValue,
  SuperpositionEmbeddableConfig,
  SuperpositionLayoutConfig,
  SuperpositionThemeMode,
  SuperpositionThemeTokens,
} from "../types";
import { getLockedDimensions, mergeScopedContext } from "../utils/context-filter";
import { normalizeSuperpositionConfig } from "../utils/normalize-config";
import { ThemeContext, type SuperpositionThemeValue } from "./theme-context";

export type BoundaryContext = Record<string, JsonValue>;

export interface SuperpositionScopeState {
  hostContext?: BoundaryContext;
  boundaryContext?: BoundaryContext;
  effectiveContext?: BoundaryContext;
  lockedDimensions: string[];
  hasBoundaryContext: boolean;
  setBoundaryContext: (context?: BoundaryContext) => void;
  clearBoundaryContext: () => void;
}

export interface SuperpositionContextValue {
  config: SuperpositionEmbeddableConfig;
  client: SuperpositionClient;
  dimensions: ReturnType<typeof dimensionsApi>;
  defaultConfigs: ReturnType<typeof defaultConfigsApi>;
  overrides: ReturnType<typeof overridesApi>;
  resolve: ReturnType<typeof resolveApi>;
  scope: SuperpositionScopeState;
}

const SuperpositionContext = createContext<SuperpositionContextValue | null>(null);
const ignoreBoundaryContext = () => {};

function getSystemThemeMode(): Exclude<SuperpositionThemeMode, "system"> {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

function resolveTheme(
  config: SuperpositionEmbeddableConfig,
  systemMode: Exclude<SuperpositionThemeMode, "system">,
): SuperpositionThemeValue {
  const mode = config.theme?.mode ?? "light";
  return {
    mode,
    resolvedMode: mode === "system" ? systemMode : mode,
    tokens: config.theme,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge<T>(base: T, ...overrides: unknown[]): T {
  const output: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  overrides.forEach((override) => {
    if (!isRecord(override)) return;

    Object.entries(override).forEach(([key, value]) => {
      const current = output[key];
      output[key] =
        isRecord(current) && isRecord(value) ? deepMerge(current, value) : value;
    });
  });

  return output as T;
}

function buildBlendFoundationTokens(tokens?: SuperpositionThemeTokens): BlendThemeType {
  const colors = tokens?.colors;
  const legacyColorOverrides = {
    colors: {
      gray: {
        0: colors?.panel,
        50: colors?.bg,
        100: colors?.bg,
        150: colors?.border,
        200: colors?.border,
        400: colors?.muted,
        500: colors?.muted,
        700: colors?.text,
        800: colors?.text,
        900: colors?.text,
        950: colors?.text,
      },
      primary: {
        50: colors?.primary
          ? "color-mix(in oklab, var(--sp-color-primary) 10%, white)"
          : undefined,
        500: colors?.primary,
        600: colors?.primary,
        700: colors?.primary,
      },
      red: {
        500: colors?.danger,
        600: colors?.danger,
      },
      green: {
        500: colors?.success,
        600: colors?.success,
      },
      yellow: {
        500: colors?.warning,
      },
    },
  };

  return deepMerge<BlendThemeType>(
    FOUNDATION_THEME,
    legacyColorOverrides,
    tokens?.blend?.foundationTokens,
  );
}

function buildThemeVars(
  mode: SuperpositionThemeMode,
  tokens?: SuperpositionThemeTokens,
  layout?: SuperpositionLayoutConfig,
): React.CSSProperties {
  const isDark = mode === "dark";
  const foundation = buildBlendFoundationTokens(tokens);
  const foundationColors = foundation.colors;
  const foundationFont = foundation.font;
  const foundationUnit = foundation.unit;
  const foundationRadius = foundation.border.radius;
  const foundationShadow = foundation.shadows;
  const colors = tokens?.colors;
  const radius = tokens?.radius;
  const spacing = tokens?.spacing;
  const shadow = tokens?.shadow;
  const typography = tokens?.typography;
  const table = tokens?.table;
  const tableHeader = table?.header;
  const button = tokens?.button;
  const buttonPrimary = button?.primary;
  const buttonSecondary = button?.secondary;
  const buttonDanger = button?.danger;
  const form = tokens?.form;
  const formLabel = form?.label;
  const formRemoveButton = form?.removeButton;
  const dropdown = tokens?.dropdown;
  const dropdownControl = dropdown?.control;
  const dropdownMenu = dropdown?.menu;
  const dropdownOption = dropdown?.option;
  const icon = tokens?.icon;
  const lockIcon = icon?.lock;
  const search = tokens?.search;
  const searchIcon = search?.icon;
  const toast = tokens?.toast;
  const toastSuccess = toast?.success;
  const toastError = toast?.error;
  const toastWarning = toast?.warning;
  const toastInfo = toast?.info;
  const banner = tokens?.banner;
  const bannerWarning = banner?.warning;
  const pageTitle = tokens?.pageTitle;
  const jsonValue = tokens?.jsonValue;
  const tooltip = tokens?.tooltip;

  return {
    "--sp-color-bg":
      colors?.bg ?? (isDark ? foundationColors.gray[950] : foundationColors.gray[50]),
    "--sp-color-panel":
      colors?.panel ?? (isDark ? foundationColors.gray[900] : foundationColors.gray[0]),
    "--sp-color-text":
      colors?.text ?? (isDark ? foundationColors.gray[50] : foundationColors.gray[950]),
    "--sp-color-muted":
      colors?.muted ?? (isDark ? foundationColors.gray[400] : foundationColors.gray[500]),
    "--sp-color-border":
      colors?.border ??
      (isDark ? foundationColors.gray[700] : foundationColors.gray[200]),
    "--sp-color-primary": colors?.primary ?? foundationColors.primary[500],
    "--sp-color-primary-soft":
      "color-mix(in oklab, var(--sp-color-primary) 10%, var(--sp-color-panel))",
    "--sp-color-success": colors?.success ?? foundationColors.green[500],
    "--sp-color-warning": colors?.warning ?? foundationColors.yellow[500],
    "--sp-color-danger": colors?.danger ?? foundationColors.red[500],
    "--sp-shadow-sm": shadow?.sm ?? foundationShadow.xs,
    "--sp-shadow-md": shadow?.md ?? foundationShadow.md,
    "--sp-radius-sm": radius?.sm ?? foundationRadius[6],
    "--sp-radius-md": radius?.md ?? foundationRadius[8],
    "--sp-radius-lg": radius?.lg ?? foundationRadius[12],
    "--sp-space-xs": spacing?.xs ?? foundationUnit[4],
    "--sp-space-sm": spacing?.sm ?? foundationUnit[12],
    "--sp-space-md": spacing?.md ?? foundationUnit[16],
    "--sp-space-lg": spacing?.lg ?? foundationUnit[24],
    "--sp-admin-content-min-height": layout?.adminContentMinHeight ?? "620px",
    "--sp-modal-width":
      layout?.modalWidth ?? "min(620px, calc(100vw - (var(--sp-space-lg) * 2)))",
    "--sp-modal-min-width":
      layout?.modalMinWidth ?? "min(400px, calc(100vw - (var(--sp-space-lg) * 2)))",
    "--sp-modal-max-width": layout?.modalMaxWidth ?? "600px",
    "--sp-modal-max-height": layout?.modalMaxHeight ?? "min(80vh, 720px)",
    "--sp-confirm-width":
      layout?.confirmWidth ?? "min(420px, calc(100vw - (var(--sp-space-lg) * 2)))",
    "--sp-alert-min-width":
      layout?.alertMinWidth ?? "min(300px, calc(100vw - (var(--sp-space-lg) * 2)))",
    "--sp-table-min-width": layout?.tableMinWidth ?? "720px",
    "--sp-table-empty-min-height": layout?.tableEmptyMinHeight ?? "168px",
    "--sp-table-opacity": table?.opacity ?? "1",
    "--sp-compact-control-padding":
      layout?.compactControlPadding ?? "calc(var(--sp-space-xs) / 2) var(--sp-space-xs)",
    "--sp-color-surface-muted":
      "color-mix(in oklab, var(--sp-color-panel) 88%, var(--sp-color-bg))",
    "--sp-color-surface-subtle":
      "color-mix(in oklab, var(--sp-color-panel) 72%, var(--sp-color-bg))",
    "--sp-color-overlay": isDark ? "rgba(8, 7, 14, 0.72)" : "rgba(22, 16, 40, 0.48)",
    "--sp-control-bg": "var(--sp-color-panel)",
    "--sp-control-text": "var(--sp-color-text)",
    "--sp-control-border": "var(--sp-color-border)",
    "--sp-control-radius": "var(--sp-radius-md)",
    "--sp-card-radius": "var(--sp-radius-lg)",
    "--sp-inline-radius": "var(--sp-radius-sm)",
    "--sp-pill-radius": "999px",
    "--sp-table-header-bg":
      tableHeader?.bgColor ?? table?.bgColor ?? "var(--sp-color-surface-muted)",
    "--sp-table-header-text":
      tableHeader?.textColor ?? table?.textColor ?? "var(--sp-color-text)",
    "--sp-table-header-font-size": tableHeader?.fontSize ?? table?.fontSize ?? "12px",
    "--sp-table-header-font-weight":
      tableHeader?.fontWeight ?? table?.fontWeight ?? "600",
    "--sp-table-header-text-transform":
      tableHeader?.textTransform ?? table?.textTransform ?? "uppercase",
    "--sp-table-header-padding":
      tableHeader?.padding ?? table?.padding ?? "var(--sp-space-sm) var(--sp-space-md)",
    "--sp-table-header-opacity": tableHeader?.opacity ?? "1",
    "--sp-button-primary-bg":
      buttonPrimary?.bgColor ?? button?.bgColor ?? "var(--sp-color-primary)",
    "--sp-button-primary-text":
      buttonPrimary?.textColor ?? button?.textColor ?? foundationColors.gray[0],
    "--sp-button-primary-border":
      buttonPrimary?.borderColor ?? button?.borderColor ?? "transparent",
    "--sp-button-primary-shadow": buttonPrimary?.shadow ?? button?.shadow ?? "none",
    "--sp-button-secondary-bg":
      buttonSecondary?.bgColor ?? button?.bgColor ?? "var(--sp-color-panel)",
    "--sp-button-secondary-text":
      buttonSecondary?.textColor ?? button?.textColor ?? "var(--sp-color-text)",
    "--sp-button-secondary-border":
      buttonSecondary?.borderColor ?? button?.borderColor ?? "var(--sp-color-border)",
    "--sp-button-danger-bg":
      buttonDanger?.bgColor ??
      button?.bgColor ??
      "color-mix(in oklab, var(--sp-color-danger) 12%, var(--sp-color-panel))",
    "--sp-button-danger-text":
      buttonDanger?.textColor ??
      button?.textColor ??
      "color-mix(in oklab, var(--sp-color-danger) 78%, var(--sp-color-text))",
    "--sp-button-danger-border":
      buttonDanger?.borderColor ??
      button?.borderColor ??
      "color-mix(in oklab, var(--sp-color-danger) 28%, var(--sp-color-border))",
    "--sp-button-disabled-opacity": button?.disabledOpacity ?? "0.56",
    "--sp-button-padding":
      button?.padding ?? `${foundationUnit[8]} ${foundationUnit[12]}`,
    "--sp-button-radius": button?.borderRadius ?? "var(--sp-control-radius)",
    "--sp-button-font-size": button?.fontSize ?? foundationFont.fontSize[14],
    "--sp-button-font-weight": button?.fontWeight ?? foundationFont.weight[500],
    "--sp-icon-size": icon?.size ?? foundationUnit[16],
    "--sp-icon-color": icon?.color ?? "var(--sp-color-muted)",
    "--sp-lock-icon-size": lockIcon?.size ?? icon?.size ?? foundationUnit[14],
    "--sp-lock-icon-color": lockIcon?.color ?? icon?.color ?? "var(--sp-color-muted)",
    "--sp-json-value-bg": jsonValue?.bgColor ?? "var(--sp-color-surface-subtle)",
    "--sp-json-value-border": jsonValue?.borderColor ?? "var(--sp-color-border)",
    "--sp-json-value-radius": jsonValue?.borderRadius ?? "var(--sp-inline-radius)",
    "--sp-form-label-color":
      formLabel?.textColor ?? form?.textColor ?? "var(--sp-color-text)",
    "--sp-form-label-font-size": formLabel?.fontSize ?? form?.fontSize ?? "0.9rem",
    "--sp-form-label-font-weight": formLabel?.fontWeight ?? form?.fontWeight ?? "700",
    "--sp-form-helper-color": form?.helperTextColor ?? "var(--sp-color-muted)",
    "--sp-form-remove-button-bg":
      formRemoveButton?.bgColor ??
      (isDark ? foundationColors.red[950] : foundationColors.red[50]),
    "--sp-form-remove-button-text":
      formRemoveButton?.textColor ??
      (isDark ? foundationColors.red[300] : foundationColors.red[600]),
    "--sp-form-remove-button-border":
      formRemoveButton?.borderColor ??
      (isDark ? foundationColors.red[800] : foundationColors.red[200]),
    "--sp-form-remove-button-radius":
      formRemoveButton?.borderRadius ?? "var(--sp-radius-md)",
    "--sp-form-remove-button-width": formRemoveButton?.width ?? "32px",
    "--sp-form-remove-button-height": formRemoveButton?.height ?? "32px",
    "--sp-form-remove-button-icon-size": formRemoveButton?.fontSize ?? foundationUnit[16],
    "--sp-form-remove-button-shadow": formRemoveButton?.shadow ?? "none",
    "--sp-search-bg": search?.bgColor ?? "var(--sp-control-bg)",
    "--sp-search-text": search?.textColor ?? "var(--sp-control-text)",
    "--sp-search-placeholder": search?.placeholderColor ?? "var(--sp-color-muted)",
    "--sp-search-placeholder-opacity": search?.placeholderOpacity ?? "1",
    "--sp-search-border": search?.borderColor ?? "var(--sp-control-border)",
    "--sp-search-radius": search?.borderRadius ?? "var(--sp-control-radius)",
    "--sp-search-padding": search?.padding ?? "var(--sp-space-sm) var(--sp-space-md)",
    "--sp-search-width": search?.width ?? "min(360px, 100%)",
    "--sp-search-height": search?.height ?? "40px",
    "--sp-search-font-size": search?.fontSize ?? foundationFont.fontSize[14],
    "--sp-search-font-weight": search?.fontWeight ?? foundationFont.weight[400],
    "--sp-search-shadow": search?.shadow ?? "none",
    "--sp-search-opacity": search?.opacity ?? "1",
    "--sp-search-hover-bg": search?.hoverBgColor ?? "var(--sp-search-bg)",
    "--sp-search-hover-text": search?.hoverTextColor ?? "var(--sp-search-text)",
    "--sp-search-hover-border": search?.hoverBorderColor ?? "var(--sp-search-border)",
    "--sp-search-hover-shadow": search?.hoverShadow ?? "var(--sp-search-shadow)",
    "--sp-search-focus-bg": search?.focusBgColor ?? "var(--sp-search-hover-bg)",
    "--sp-search-focus-text": search?.focusTextColor ?? "var(--sp-search-hover-text)",
    "--sp-search-focus-border": search?.focusBorderColor ?? "var(--sp-color-primary)",
    "--sp-search-focus-shadow": search?.focusShadow ?? foundationShadow.focusPrimary,
    "--sp-search-focus-outline": search?.focusOutline ?? "none",
    "--sp-search-focus-outline-offset": search?.focusOutlineOffset ?? "0",
    "--sp-search-icon-size": searchIcon?.size ?? icon?.size ?? foundationUnit[18],
    "--sp-search-icon-color": searchIcon?.color ?? icon?.color ?? "var(--sp-color-muted)",
    "--sp-search-hover-icon-color":
      search?.hoverIconColor ?? "var(--sp-search-icon-color)",
    "--sp-search-focus-icon-color":
      search?.focusIconColor ?? "var(--sp-search-hover-icon-color)",
    "--sp-dropdown-width": dropdown?.width ?? "260px",
    "--sp-dropdown-control-bg":
      dropdownControl?.bgColor ?? dropdown?.bgColor ?? "var(--sp-control-bg)",
    "--sp-dropdown-control-text":
      dropdownControl?.textColor ?? dropdown?.textColor ?? "var(--sp-control-text)",
    "--sp-dropdown-control-border":
      dropdownControl?.borderColor ?? dropdown?.borderColor ?? "var(--sp-control-border)",
    "--sp-dropdown-control-radius":
      dropdownControl?.borderRadius ??
      dropdown?.borderRadius ??
      "var(--sp-control-radius)",
    "--sp-dropdown-menu-bg":
      dropdownMenu?.bgColor ?? dropdown?.bgColor ?? "var(--sp-color-panel)",
    "--sp-dropdown-menu-border":
      dropdownMenu?.borderColor ?? dropdown?.borderColor ?? "var(--sp-color-border)",
    "--sp-dropdown-menu-shadow":
      dropdownMenu?.shadow ?? dropdown?.shadow ?? "var(--sp-shadow-md)",
    "--sp-dropdown-option-hover-bg":
      dropdownOption?.hoverBgColor ?? "var(--sp-color-surface-muted)",
    "--sp-dropdown-option-selected-bg":
      dropdownOption?.selectedBgColor ?? "var(--sp-color-surface-muted)",
    "--sp-dropdown-option-selected-text":
      dropdownOption?.selectedTextColor ?? "var(--sp-color-text)",
    "--sp-tooltip-bg": tooltip?.bgColor ?? "var(--sp-color-text)",
    "--sp-tooltip-text": tooltip?.textColor ?? "var(--sp-color-panel)",
    "--sp-tooltip-border":
      tooltip?.borderColor ??
      "color-mix(in oklab, var(--sp-color-text) 18%, transparent)",
    "--sp-tooltip-radius": tooltip?.borderRadius ?? "var(--sp-inline-radius)",
    "--sp-tooltip-shadow": tooltip?.shadow ?? "var(--sp-shadow-sm)",
    "--sp-tooltip-font-size": tooltip?.fontSize ?? foundationFont.fontSize[12],
    "--sp-page-title-text": pageTitle?.textColor ?? "var(--sp-color-text)",
    "--sp-page-title-font-size": pageTitle?.fontSize ?? foundationFont.fontSize[24],
    "--sp-page-title-font-weight": pageTitle?.fontWeight ?? foundationFont.weight[700],
    "--sp-page-title-margin": pageTitle?.margin ?? "0",
    "--sp-banner-bg":
      bannerWarning?.bgColor ?? banner?.bgColor ?? "var(--sp-feedback-warning-bg)",
    "--sp-banner-text":
      bannerWarning?.textColor ?? banner?.textColor ?? "var(--sp-feedback-warning-text)",
    "--sp-banner-border":
      bannerWarning?.borderColor ??
      banner?.borderColor ??
      "var(--sp-feedback-warning-border)",
    "--sp-banner-radius":
      bannerWarning?.borderRadius ?? banner?.borderRadius ?? "var(--sp-control-radius)",
    "--sp-banner-padding":
      bannerWarning?.padding ??
      banner?.padding ??
      `${foundationUnit[12]} ${foundationUnit[14]}`,
    "--sp-banner-font-size":
      bannerWarning?.fontSize ?? banner?.fontSize ?? foundationFont.fontSize[14],
    "--sp-banner-font-weight":
      bannerWarning?.fontWeight ?? banner?.fontWeight ?? foundationFont.weight[500],
    "--sp-toast-bg": toast?.bgColor ?? "var(--sp-color-panel)",
    "--sp-toast-text": toast?.textColor ?? "var(--sp-color-text)",
    "--sp-toast-border": toast?.borderColor ?? "var(--sp-color-border)",
    "--sp-toast-radius": toast?.borderRadius ?? "var(--sp-control-radius)",
    "--sp-toast-padding": toast?.padding ?? "var(--sp-space-sm) var(--sp-space-md)",
    "--sp-toast-font-size": toast?.fontSize ?? "1rem",
    "--sp-toast-font-weight": toast?.fontWeight ?? "600",
    "--sp-toast-shadow": toast?.shadow ?? "var(--sp-shadow-sm)",
    "--sp-toast-success-bg": toastSuccess?.bgColor ?? "var(--sp-toast-bg)",
    "--sp-toast-success-text": toastSuccess?.textColor ?? "var(--sp-toast-text)",
    "--sp-toast-success-border":
      toastSuccess?.borderColor ?? "var(--sp-feedback-success-border)",
    "--sp-toast-error-bg": toastError?.bgColor ?? "var(--sp-toast-bg)",
    "--sp-toast-error-text": toastError?.textColor ?? "var(--sp-toast-text)",
    "--sp-toast-error-border":
      toastError?.borderColor ?? "var(--sp-feedback-danger-border)",
    "--sp-toast-warning-bg": toastWarning?.bgColor ?? "var(--sp-toast-bg)",
    "--sp-toast-warning-text": toastWarning?.textColor ?? "var(--sp-toast-text)",
    "--sp-toast-warning-border":
      toastWarning?.borderColor ?? "var(--sp-feedback-warning-border)",
    "--sp-toast-info-bg": toastInfo?.bgColor ?? "var(--sp-toast-bg)",
    "--sp-toast-info-text": toastInfo?.textColor ?? "var(--sp-toast-text)",
    "--sp-toast-info-border": toastInfo?.borderColor ?? "var(--sp-feedback-info-border)",
    "--sp-feedback-info-bg": "var(--sp-color-primary-soft)",
    "--sp-feedback-info-text": "var(--sp-color-text)",
    "--sp-feedback-info-border":
      "color-mix(in oklab, var(--sp-color-primary) 24%, var(--sp-color-border))",
    "--sp-feedback-success-bg":
      "color-mix(in oklab, var(--sp-color-success) 14%, var(--sp-color-panel))",
    "--sp-feedback-success-text":
      "color-mix(in oklab, var(--sp-color-success) 72%, var(--sp-color-text))",
    "--sp-feedback-success-border":
      "color-mix(in oklab, var(--sp-color-success) 32%, var(--sp-color-border))",
    "--sp-feedback-warning-bg":
      "color-mix(in oklab, var(--sp-color-warning) 18%, var(--sp-color-panel))",
    "--sp-feedback-warning-text":
      "color-mix(in oklab, var(--sp-color-warning) 76%, var(--sp-color-text))",
    "--sp-feedback-warning-border":
      "color-mix(in oklab, var(--sp-color-warning) 34%, var(--sp-color-border))",
    "--sp-feedback-danger-bg":
      "color-mix(in oklab, var(--sp-color-danger) 12%, var(--sp-color-panel))",
    "--sp-feedback-danger-text":
      "color-mix(in oklab, var(--sp-color-danger) 78%, var(--sp-color-text))",
    "--sp-feedback-danger-border":
      "color-mix(in oklab, var(--sp-color-danger) 32%, var(--sp-color-border))",
    "--sp-feedback-neutral-bg":
      "color-mix(in oklab, var(--sp-color-muted) 14%, var(--sp-color-panel))",
    "--sp-feedback-neutral-text": "var(--sp-color-text)",
    "--sp-feedback-neutral-border":
      "color-mix(in oklab, var(--sp-color-muted) 22%, var(--sp-color-border))",
    fontFamily:
      typography?.fontFamily ??
      foundationFont.family.body ??
      'InterDisplay, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    fontSize: typography?.fontSize ?? foundationFont.fontSize[14],
    color: "var(--sp-color-text)",
  } as React.CSSProperties;
}

export function useSuperposition(): SuperpositionContextValue {
  const ctx = useContext(SuperpositionContext);
  if (!ctx) {
    throw new Error("useSuperposition must be used within a <SuperpositionUIProvider>");
  }
  return ctx;
}

export function useOptionalSuperposition(): SuperpositionContextValue | null {
  return useContext(SuperpositionContext);
}

export function useSuperpositionTheme(): SuperpositionThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error(
      "useSuperpositionTheme must be used within a <SuperpositionUIProvider>",
    );
  }
  return ctx;
}

export function useOptionalSuperpositionTheme(): SuperpositionThemeValue | null {
  return useContext(ThemeContext);
}

export function useOptionalSuperpositionThemeStyles(): React.CSSProperties | undefined {
  const ctx = useContext(SuperpositionContext);
  const themeValue = useContext(ThemeContext);

  return useMemo(
    () =>
      themeValue
        ? buildThemeVars(themeValue.resolvedMode, themeValue.tokens, ctx?.config.layout)
        : undefined,
    [ctx?.config.layout, themeValue],
  );
}

export interface SuperpositionUIProviderProps {
  config: SuperpositionEmbeddableConfig;
  children: React.ReactNode;
}

export function SuperpositionUIProvider({
  config,
  children,
}: SuperpositionUIProviderProps) {
  const normalizedConfig = useMemo(() => normalizeSuperpositionConfig(config), [config]);
  const [systemMode, setSystemMode] =
    useState<Exclude<SuperpositionThemeMode, "system">>(getSystemThemeMode);
  const [boundaryContext, setBoundaryContextState] = useState<
    BoundaryContext | undefined
  >();

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemMode(query.matches ? "dark" : "light");

    handleChange();
    query.addEventListener?.("change", handleChange);
    return () => query.removeEventListener?.("change", handleChange);
  }, []);

  const setBoundaryContext = useCallback((next?: BoundaryContext) => {
    if (!next || Object.keys(next).length === 0) {
      setBoundaryContextState(undefined);
      return;
    }

    setBoundaryContextState(next);
  }, []);

  const clearBoundaryContext = useCallback(() => {
    setBoundaryContextState(undefined);
  }, []);

  const value = useMemo<SuperpositionContextValue>(() => {
    const client = new SuperpositionClient(config);
    const hostContext = normalizedConfig.context;
    const strictScope = config.strict === true;
    const activeBoundaryContext = strictScope ? undefined : boundaryContext;
    const mergedScope = mergeScopedContext(activeBoundaryContext ?? {}, hostContext);
    const effectiveContext =
      Object.keys(mergedScope).length > 0 ? mergedScope : undefined;

    return {
      config,
      client,
      dimensions: dimensionsApi(client),
      defaultConfigs: defaultConfigsApi(client),
      overrides: overridesApi(client),
      resolve: resolveApi(client),
      scope: {
        hostContext,
        boundaryContext: activeBoundaryContext,
        effectiveContext,
        lockedDimensions: getLockedDimensions(effectiveContext),
        hasBoundaryContext: Boolean(
          activeBoundaryContext && Object.keys(activeBoundaryContext).length > 0,
        ),
        setBoundaryContext: strictScope ? ignoreBoundaryContext : setBoundaryContext,
        clearBoundaryContext,
      },
    };
  }, [
    boundaryContext,
    clearBoundaryContext,
    config,
    normalizedConfig,
    setBoundaryContext,
  ]);

  const themeValue = useMemo(
    () => resolveTheme(config, systemMode),
    [config, systemMode],
  );
  const themeStyles = useMemo(
    () => buildThemeVars(themeValue.resolvedMode, themeValue.tokens, config.layout),
    [config.layout, themeValue.resolvedMode, themeValue.tokens],
  );
  const blendFoundationTokens = useMemo(
    () => buildBlendFoundationTokens(themeValue.tokens),
    [themeValue.tokens],
  );
  const blendComponentTokens = useMemo(
    () =>
      themeValue.tokens?.blend?.componentTokens as BlendComponentTokenType | undefined,
    [themeValue.tokens],
  );
  const blendTheme =
    themeValue.resolvedMode === "dark" ? BlendTheme.DARK : BlendTheme.LIGHT;

  return (
    <SuperpositionContext.Provider value={value}>
      <ThemeContext.Provider value={themeValue}>
        <BlendThemeProvider
          theme={blendTheme}
          foundationTokens={blendFoundationTokens}
          componentTokens={blendComponentTokens}
        >
          <div
            className="sp-ui"
            data-sp-theme={themeValue.resolvedMode}
            style={themeStyles}
          >
            {children}
          </div>
        </BlendThemeProvider>
      </ThemeContext.Provider>
    </SuperpositionContext.Provider>
  );
}
