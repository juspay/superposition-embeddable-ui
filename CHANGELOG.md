# Changelog

This package is distributed through this repository's GitHub Releases.

## 0.1.8

- Fixed the experiment wizard's colour picker: Chrome ignored the size set on the bare `input[type=color]`, so it rendered as a tall thin box. The swatch is now a styled element with the native input transparent on top of it.
- Laid the Experiment details fields (name, description, change reason, audience context) out with the label beside the control, matching the metric and variant rows in the rest of the wizard.
- Gave the hypothesis field the size it asks for: routing it through `FormField` swapped it for Blend's `TextArea`, whose props omit `style`/`className`, so its width and min-height were dropped and it repeated the panel's own label.
- Kept the variant badge inside its card in the review modal instead of letting long labels run past the edge.
- Made the hypothesis mandatory whenever metrics are enabled — it becomes the experiment's description and change reason, which used to be saved as "Description not provided" / "Change Reason not provided" when it was left empty. Step 2's Next and the Launch button are both gated on it, and those placeholder strings are gone.
- Corrected the traffic split readouts: `traffic_percentage` applies to each variant, so both arms now show the same share and the untouched remainder is spelled out ("Control 8% · Variant B 8% — 84% unaffected") instead of giving control `100 - t`%. Removed the "Favor Control (70/30)" preset, which a single per-variant percentage cannot express.
- Gave the shared control styles a fallback colour and font, so inputs keep a visible border when a host supplies no theme colours.

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
