import { builtinModules } from "node:module";
import { defineConfig } from "vite-plus";

const external = new Set([
  "coc.nvim",
  ...builtinModules,
  ...builtinModules.map((id) => `node:${id}`),
]);

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["cjs"],
      fileName: () => "index.js",
    },
    minify: false,
    outDir: "lib",
    rollupOptions: {
      external: Array.from(external),
      output: {
        exports: "named",
      },
    },
    sourcemap: false,
  },
  staged: {
    "*": "vp check --fix",
  },
});
