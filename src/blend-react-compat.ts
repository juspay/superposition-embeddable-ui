import React from "react";
import ReactDOM from "react-dom";

const CLIENT_INTERNALS_KEY =
  "__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE";

type ObjectWithInternals = Record<string, unknown>;

function patchClientInternals(candidate: unknown) {
  if (!candidate || typeof candidate !== "object") return;

  const obj = candidate as ObjectWithInternals;
  if (obj[CLIENT_INTERNALS_KEY]) return;

  Object.defineProperty(obj, CLIENT_INTERNALS_KEY, {
    configurable: true,
    writable: true,
    value: { T: null },
  });
}

// Blend 0.0.36 bundles a ReactDOM 19 flushSync helper; React 18 does not
// expose __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
// on either `react` or `react-dom`. The helper reads `.T` off the internals
// object, which throws when undefined. Patching both modules with a stub
// { T: null } keeps popovers and dropdowns from crashing.
patchClientInternals(React);
patchClientInternals((React as ObjectWithInternals).default);
patchClientInternals(ReactDOM);
