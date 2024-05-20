// Some parts of this extension are inspired by <https://github.com/fannheyward/coc-biome/blob/master/src/index.ts#L50>
import { existsSync } from "node:fs";
import { join } from "path";
import {
  Executable,
  ExtensionContext,
  LanguageClient,
  LanguageClientOptions,
  OutputChannel,
  ServerOptions,
  commands,
  services,
  window,
  workspace,
} from "coc.nvim";

type Optional<T> = T | null;

type CommandGeneralAction = (
  channel: OutputChannel,
  traceChannel: OutputChannel
) => Promise<void> | void;

type CommandClientAction = (client: LanguageClient) => Promise<void> | void;

const CLIENT_ID = "coc-oxc";
const CLIENT_NAME = "oxc";
const OUTPUT_CHANNEL = "oxc";
const TRACE_CHANNEL = "oxc-trace";

const GENERAL_COMMANDS: { id: string; action: CommandGeneralAction }[] = [
  {
    id: "oxc.showOutputChannel",
    action: (channel: OutputChannel) => {
      channel.show();
    },
  },
  {
    id: "oxc.showTraceOutputChannel",
    action: (_, channel: OutputChannel) => {
      channel.show();
    },
  },
];

const CLIENT_COMMANDS: { id: string; action: CommandClientAction }[] = [
  {
    id: "oxc.restartServer",
    action: async (client: LanguageClient) => {
      if (!client) {
        window.showErrorMessage("oxc client not found");
        return;
      }

      try {
        client.restart();
        window.showInformationMessage("oxc server restarted.");
      } catch (err) {
        client.error("Restarting client failed", err);
      }
    },
  },
];

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

function createClient(outputChannel: OutputChannel): LanguageClient {
  const clientOptions: LanguageClientOptions = {
    outputChannel,
    progressOnInitialization: true,
    initializationOptions: {},
    documentSelector: [
      "typescript",
      "javascript",
      "typescriptreact",
      "javascriptreact",
      "vue",
      "svelte",
    ].map((language) => ({
      language,
      scheme: "file",
    })),
  };

  return new LanguageClient(
    CLIENT_ID,
    CLIENT_NAME,
    serverOptions(),
    clientOptions
  );
}

function configureClient(context: ExtensionContext, client: LanguageClient) {
  context.subscriptions.push(
    ...CLIENT_COMMANDS.map(({ id, action }) =>
      commands.registerCommand(id, () => action(client))
    )
  );
}

export async function activate(context: ExtensionContext): Promise<void> {
  const enable = workspace.getConfiguration("oxc").get<boolean>("enable", true);
  if (!enable) {
    return;
  }

  const channel = window.createOutputChannel(OUTPUT_CHANNEL);
  const traceChannel = window.createOutputChannel(TRACE_CHANNEL);

  const println = (msg: unknown) => channel.appendLine(String(msg));

  context.subscriptions.push(
    ...GENERAL_COMMANDS.map(({ id, action }) =>
      commands.registerCommand(id, () => action(channel, traceChannel))
    )
  );

  try {
    const client = createClient(channel);
    configureClient(context, client);
    context.subscriptions.push(services.registerLanguageClient(client));
  } catch (e: unknown) {
    println(e);
  }
}
