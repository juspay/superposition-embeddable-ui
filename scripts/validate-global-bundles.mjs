// The `*.global.external.js` bundles run as plain <script> tags against the
// React globals a host page already has. Anything that survives bundling as
// CommonJS (a stray `require(...)`) throws before the bundle assigns its
// global, so the host sees "<Feature> isn't available" with no other clue.
// Loading each bundle in jsdom catches that at build time.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(rootDir, "dist");

const vendorScripts = [
  "vendor/react.production.min.js",
  "vendor/react-dom.production.min.js",
];

const globalBundles = [
  ["superposition-browser-core.global.external.js", "SuperpositionBrowserCore"],
  ["superposition-embeddable-ui.global.external.js", "SuperpositionEmbeddableUI"],
  ["superposition-admin.global.external.js", "SuperpositionAdminUI"],
  ["superposition-config-manager.global.external.js", "SuperpositionConfigManagerUI"],
  ["superposition-override-manager.global.external.js", "SuperpositionOverrideManagerUI"],
  [
    "superposition-dimension-manager.global.external.js",
    "SuperpositionDimensionManagerUI",
  ],
  ["superposition-audit-trail.global.external.js", "SuperpositionAuditTrailUI"],
  [
    "superposition-experiment-manager.global.external.js",
    "SuperpositionExperimentManagerUI",
  ],
];

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  runScripts: "dangerously",
  pretendToBeVisual: true,
});
const { window } = dom;

const failures = [];

const evaluate = (file) => {
  try {
    window.eval(readFileSync(join(distDir, file), "utf8"));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

for (const file of vendorScripts) {
  const failure = evaluate(file);
  if (failure) failures.push(`${file} threw while loading: ${failure}`);
}

if (typeof window.React !== "object" || typeof window.ReactDOM !== "object") {
  failures.push("vendor React globals were not set; the bundles cannot be checked");
}

for (const [file, globalName] of globalBundles) {
  const failure = evaluate(file);

  if (failure) {
    failures.push(`${file} threw while loading: ${failure}`);
    continue;
  }

  if (typeof window[globalName] !== "object") {
    failures.push(`${file} loaded but never defined globalThis.${globalName}`);
  }
}

if (typeof window.SuperpositionBrowserCore?.mountSuperpositionFeature !== "function") {
  failures.push("SuperpositionBrowserCore.mountSuperpositionFeature is missing");
}

if (failures.length > 0) {
  console.error("Global bundle validation failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Global bundles load cleanly (${globalBundles.length} checked).`);
