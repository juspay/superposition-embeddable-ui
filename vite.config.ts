import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const externalPackages = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
];

function isExternal(id: string) {
  return (
    externalPackages.includes(id) || id.startsWith("@juspay/blend-design-system")
  );
}

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
        "styles-entry": resolve(__dirname, "src/styles-entry.ts"),
      },
      name: "SuperpositionAdminUI",
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format === "es" ? "js" : "cjs"}`,
      cssFileName: "styles",
    },
    rollupOptions: {
      external: isExternal,
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react-dom/client": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
        },
      },
    },
  },
});
