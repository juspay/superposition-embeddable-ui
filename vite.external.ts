import { resolve } from "path";

export function createExternalMatcher(
  packageNames: readonly string[],
  packagePrefixes: readonly string[],
) {
  return function isExternal(id: string) {
    return (
      packageNames.includes(id) || packagePrefixes.some((prefix) => id.startsWith(prefix))
    );
  };
}

export const isLibraryExternal = createExternalMatcher(
  ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  ["@juspay/blend-design-system"],
);

// The IIFE bundles for plain <script> hosts read React off the page's globals.
// React 18 exposes no global for the automatic JSX runtime, so it is aliased to
// a local createElement shim instead of being bundled - see
// src/browser/react-jsx-runtime.ts.
export const cdnExternalIds = ["react", "react-dom", "react-dom/client"] as const;

export const cdnExternalGlobals = {
  react: "React",
  "react-dom": "ReactDOM",
  "react-dom/client": "ReactDOM",
} as const;

export function cdnJsxRuntimeAlias(rootDir: string) {
  const shim = resolve(rootDir, "src/browser/react-jsx-runtime.ts");

  return {
    "react/jsx-runtime": shim,
    "react/jsx-dev-runtime": shim,
  };
}
