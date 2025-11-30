import {ExtensionContext} from "coc.nvim";
import {createActivate} from "./common";

const activateOxlint = createActivate({
  name: "oxlint",
  languages: ["typescript", "javascript", "typescriptreact", "javascriptreact", "vue", "svelte"],
});

const activateOxfmt = createActivate({
  name: "oxfmt",
  languages: ["typescript", "javascript", "typescriptreact", "javascriptreact"],
});

export async function activate(context: ExtensionContext): Promise<void> {
  await activateOxlint(context);
  await activateOxfmt(context);
}
