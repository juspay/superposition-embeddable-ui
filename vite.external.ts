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
