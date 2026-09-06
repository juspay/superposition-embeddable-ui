# Changelog

This package is distributed through this repository's GitHub Releases.

## 0.1.7

- Fixed the plain-browser bundles: `superposition-browser-core.global.external.js` threw `require is not defined` and never defined `SuperpositionBrowserCore`, so every feature global reported that it was unavailable. React's CommonJS JSX runtime is no longer bundled into the IIFE builds; they use a `createElement` shim against the host's React global instead.
- Added a build-time check that loads every `*.global.external.js` bundle and fails the build if one throws or does not define its global.

## 0.1.6

- Added the embeddable experiment manager: experiment list, detail, variants, and results views, with `superposition-embeddable-ui/experiment-manager` and browser globals.
- Restored compact table density for experiment results and keyboard access to clickable table rows.

## 0.1.5

- Aligned detail pages with the full-width layout used across the embeddable UI.

## 0.1.4

- Removed local npm cache files from the repository.
- Corrected release metadata and validation configuration.

## 0.1.3

- Added Blend design system integration.
- Added audit trail detail views.
- Improved override forms, context cards, tables, themes, and search behavior.

## 0.1.0

- Initial embeddable UI package release.
