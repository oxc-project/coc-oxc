import { defineConfig } from "rolldown";

export default defineConfig({
  input: "src/index.ts",
  output: {
    file: "lib/index.js",
    format: "cjs",
    sourcemap: process.env.NODE_ENV === "development",
    comments: "none",
  },
  external: ["coc.nvim"],
  platform: "node",
  minify: process.env.NODE_ENV === "production",
  experimental: {
    attachDebugInfo: 'none'
  }
});
