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
  lint: {
    categories: {
      correctness: "error",
      perf: "error",
    },
    options: {
      denyWarnings: true,
      typeAware: true,
      typeCheck: true,
    },
    plugins: ["typescript", "oxc", "unicorn", "import"],
  },
  staged: {
    "*": "vp check --fix",
  },
});
