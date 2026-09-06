import { createElement, Fragment } from "react";
import type { ElementType, FunctionComponent, ReactElement } from "react";

type JsxProps = Record<string, unknown>;

/**
 * The plain-browser IIFE builds take React from the `React` global, but React 18
 * ships no global for the automatic JSX runtime. Bundling react's own
 * `react/jsx-runtime` pulls in its CommonJS build, whose `require("react")`
 * survives into the IIFE and throws `require is not defined` before the bundle
 * can assign its global. Aliasing the runtime to this createElement-based shim
 * keeps the automatic JSX transform working against the external React global.
 */
function jsx(type: ElementType, props: JsxProps, key?: unknown): ReactElement {
  const config = key === undefined ? props : { ...props, key };

  return createElement(type as FunctionComponent<JsxProps>, config);
}

export { Fragment, jsx, jsx as jsxs, jsx as jsxDEV };
