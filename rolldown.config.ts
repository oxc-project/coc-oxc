import { defineConfig } from "rolldown";

export default defineConfig({
  input: "src/index.ts",
  output: {
    file: "lib/index.js",
    format: "cjs",
    sourcemap: false,
  },
  external: ["coc.nvim"],
  platform: "node",
  experimental: {
    attachDebugInfo: "none",
  },
});
