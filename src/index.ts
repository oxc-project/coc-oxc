import { ExtensionContext } from "coc.nvim";
import { createActivate } from "./common";

const activateOxlint = createActivate({
  name: "oxlint",
  languages: ["typescript", "javascript", "typescriptreact", "javascriptreact", "vue", "svelte"],
});

const activateOxfmt = createActivate({
  name: "oxfmt",
  languages: [
    "astro",
    "css",
    "graphql",
    "handlebars",
    "html",
    "javascript",
    "javascriptreact",
    "json",
    "json5",
    "jsonc",
    "less",
    "markdown",
    "mdx",
    "scss",
    "svelte",
    "typescript",
    "typescriptreact",
    "vue",
    "yaml",
  ],
});

export async function activate(context: ExtensionContext): Promise<void> {
  await activateOxlint(context);
  await activateOxfmt(context);
}
