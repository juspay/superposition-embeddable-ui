import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

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
  plugins: [react()],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/browser.tsx"),
      name: "SuperpositionEmbeddableUI",
      formats: ["es", "cjs"],
      fileName: (format) => `browser.${format === "es" ? "js" : "cjs"}`,
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
