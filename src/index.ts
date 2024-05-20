import { existsSync } from "node:fs";
import { join } from "path";
import {
  Executable,
  ExtensionContext,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  commands,
  services,
  window,
  workspace,
} from "coc.nvim";

type Optional<T> = T | null;

const CLIENT_ID = "coc-oxc";
const CLIENT_NAME = "oxc";
const OUTPUT_CHANNEL = "oxc";

/***
 * First checks for a user provided binary path in the `oxc.path` configuration.
 * Then tries to find a binary from workspace/node_modules/.bin/oxc_language_server,
 * TODO: It should also check for a global installation here!
 * Otherwise returns `null`.
 * @returns The relavant `oxc_language_server` binary for this workspace.
 ***/
function findBinary(): Optional<string> {
  const cfg = workspace.getConfiguration("biome");
  let bin = cfg.get<string>("bin", "");
  if (bin && existsSync(bin)) {
    return bin;
  }

  bin = join(workspace.root, "node_modules", ".bin", "oxc_language_server");
  return existsSync(bin) ? bin : null;
}

function serverOptions(): ServerOptions {
  const command = findBinary();
  if (!command) {
    throw "Failed to find `oxc_language_server` binary.";
  }
  const run: Executable = {
    command,
    options: {
      env: {
        ...process.env,
        RUST_LOG: process.env.RUST_LOG || "info",
      },
    },
  };

  return {
    run,
    // TODO: add debug mode.
    debug: run,
  };
}

function createClient(): LanguageClient {
  const outputChannel = window.createOutputChannel(OUTPUT_CHANNEL);

  const clientOptions: LanguageClientOptions = {
    outputChannel,
    progressOnInitialization: true,
    documentSelector: [
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "javascriptreact" },
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "typescriptreact" },
    ],
  };

  return new LanguageClient(
    CLIENT_ID,
    CLIENT_NAME,
    serverOptions(),
    clientOptions
  );
}

export async function activate(context: ExtensionContext): Promise<void> {
  const enable = workspace.getConfiguration("oxc").get<boolean>("enable", true);
  if (!enable) {
    return;
  }
  await window.showInformationMessage("coc-oxc activate!");

  const restartCommand = commands.registerCommand(
    "oxc.restartServer",
    async () => {
      await window.showInformationMessage("coc-oxc restart!");
    }
  );

  context.subscriptions.push(restartCommand);

  try {
    const client = createClient();
    context.subscriptions.push(services.registerLanguageClient(client));
  } catch (e: unknown) {
    await window.showErrorMessage(String(e));
  }
}
