import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { isLibraryExternal } from "./vite.external";

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ["src"],
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        admin: resolve(__dirname, "src/admin.ts"),
        "audit-trail": resolve(__dirname, "src/audit-trail.ts"),
        "config-manager": resolve(__dirname, "src/config-manager.ts"),
        "dimension-manager": resolve(__dirname, "src/dimension-manager.ts"),
        "override-manager": resolve(__dirname, "src/override-manager.ts"),
        "experiment-manager": resolve(__dirname, "src/experiment-manager.ts"),
        "styles-entry": resolve(__dirname, "src/styles-entry.ts"),
      },
      name: "SuperpositionAdminUI",
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format === "es" ? "js" : "cjs"}`,
      cssFileName: "styles",
    },
    rollupOptions: {
      external: isLibraryExternal,
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react-dom/client": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
        },
        manualChunks(id) {
          return id.endsWith("/src/blend-react-compat.ts")
            ? "blend-react-compat"
            : undefined;
        },
      },
    },
  },
});
